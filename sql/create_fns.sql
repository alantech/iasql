create or replace function until_iasql_operation(_optype iasql_operation_optype_enum, _params text[]) returns uuid
language plpgsql security definer
as $$
declare
    _opid uuid;
    _counter integer := 0;
    _output text;
    _err text;
    _dblink_sql text;
    _db_id text;
    _dblink_conn_count int;
begin
    select md5(random()::text || clock_timestamp()::text)::uuid into _opid;
    select current_database() into _db_id;
    -- reuse the 'iasqlopconn' db dblink connection if one exists for the session
    -- dblink connection closes automatically at the end of a session
    SELECT count(1) INTO _dblink_conn_count FROM dblink_get_connections()
        WHERE dblink_get_connections@>'{iasqlopconn}';
    IF _dblink_conn_count = 0 THEN
        PERFORM dblink_connect('iasqlopconn', 'loopback_dblink_' || _db_id);
    END IF;
    -- schedule job via dblink
    _dblink_sql := format('insert into iasql_operation (opid, optype, params) values (%L, %L, array[''%s'']::text[]);', _opid, _optype, array_to_string(_params, ''','''));
    -- raise exception '%', _dblink_sql;
    PERFORM dblink_exec('iasqlopconn', _dblink_sql);
    _dblink_sql := format('select graphile_worker.add_job(%L, json_build_object(%L, %L, %L, %L, %L, array[''%s'']::text[]));', 'operation', 'opid', _opid, 'optype', _optype, 'params', array_to_string(_params, ''','''));
    -- raise exception '%', _dblink_sql;
    -- allow statement that returns results in dblink https://stackoverflow.com/a/28299993
    PERFORM * FROM dblink('iasqlopconn', _dblink_sql) alias(col text);
    -- times out after 45 minutes = 60 * 45 = 2700 seconds
    -- currently the longest is RDS where the unit test has a timeout of 16m
    while _counter < 2700 loop
        if (select end_date from iasql_operation where opid = _opid) is not null then
            select output into _output from iasql_operation where opid = _opid;
            select err into _err from iasql_operation where opid = _opid;
            -- done!
            if _output is not null and _err is null then
                return _opid;
            end if;
            if _err is not null then
                raise exception '% error: %', _optype, _err::json->'message'
                using detail = _err;
            end if;
            -- exit sp
            return _opid;
        end if;
        perform pg_sleep(1);
        _counter := _counter + 1;
    end loop;
    -- timed out
    raise warning 'Done waiting for %.', _optype
    using hint = 'The operation will show up in the iasql_operation table when it completes under this opid: ' || _opid;
end;
$$;

create or replace function iasql_apply() returns table (
  action text,
  table_name text,
  id integer,
  description text
)
language plpgsql security definer
as $$
declare
  _opid uuid;
begin
    _opid := until_iasql_operation('APPLY', array[]::text[]);
    return query select
      j.s->>'action' as action,
      j.s->>'tableName' as table_name,
      (j.s->>'id')::integer as id,
      j.s->>'description' as description
    from (
      select json_array_elements(output::json->'rows') as s from iasql_operation where opid = _opid
    ) as j;
end;
$$;

create or replace function iasql_plan() returns table (
  action text,
  table_name text,
  id integer,
  description text
)
language plpgsql security definer
as $$
declare
  _opid uuid;
begin
    _opid := until_iasql_operation('PLAN', array[]::text[]);
    return query select
      j.s->>'action' as action,
      j.s->>'tableName' as table_name,
      (j.s->>'id')::integer as id,
      j.s->>'description' as description
    from (
      select json_array_elements(output::json->'rows') as s from iasql_operation where opid = _opid
    ) as j;
end;
$$;

create or replace function iasql_sync() returns table (
  action text,
  table_name text,
  id integer,
  description text
)
language plpgsql security definer
as $$
declare
  _opid uuid;
begin
    _opid := until_iasql_operation('SYNC', array[]::text[]);
    return query select
      j.s->>'action' as action,
      j.s->>'tableName' as table_name,
      (j.s->>'id')::integer as id,
      j.s->>'description' as description
    from (
      select json_array_elements(output::json->'rows') as s from iasql_operation where opid = _opid
    ) as j;
end;
$$;

create or replace function iasql_install(variadic _mods text[]) returns table (
    module_name character varying,
    table_name character varying,
    record_count int
)
language plpgsql security definer
as $$
begin
    perform until_iasql_operation('INSTALL', _mods);
    return query select
        m.name as module_name,
        t.table as table_name,
        (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
    from iasql_module as m
    inner join iasql_tables as t on m.name = t.module
    where m.name = any (_mods);
end;
$$;

create or replace function iasql_uninstall(variadic _mods text[]) returns table (
    module_name character varying,
    table_name character varying,
    record_count int
)
language plpgsql security definer
as $$
declare
    _db_id text;
    _dblink_conn_count int;
    _dblink_sql text;
    _out json;
begin
    select current_database() into _db_id;
    -- reuse the 'iasqlopconn' db dblink connection if one exists for the session
    -- dblink connection closes automatically at the end of a session
    SELECT count(1) INTO _dblink_conn_count FROM dblink_get_connections()
        WHERE dblink_get_connections@>'{iasqlopconn}';
    IF _dblink_conn_count = 0 THEN
        PERFORM dblink_connect('iasqlopconn', 'loopback_dblink_' || _db_id);
    END IF;
    -- define the query to get the current tables and record counts for the modules to be removed
    -- TODO: Are these hoops to encode into JSON and then decode back out necessary now that
    -- dblink is being used here, too?
    _dblink_sql := format($dblink$
    select json_agg(row_to_json(row(j.module_name, j.table_name, j.record_count))) as js from (
        select
        m.name as module_name,
        t.table as table_name,
        (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
        from iasql_module as m
        inner join iasql_tables as t on m.name = t.module
        where m.name in ('%s')
    ) as j;
    $dblink$, array_to_string(_mods, ''','''));
    -- Execute the query on another connection so the table access doesn't count on this
    -- transaction and cause Postgres to softlock itself
    select js into _out from dblink('iasqlopconn', _dblink_sql) as x(js json);
    -- Now actually remove the modules and tables in question
    perform until_iasql_operation('UNINSTALL', _mods);
    -- And extract the metadata from the JSON blob and return it to the user
    return query select f1 as module_name, f2 as table_name, f3 as record_count from json_to_recordset(_out) as x(f1 character varying, f2 character varying, f3 int);
end;
$$;