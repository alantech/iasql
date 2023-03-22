-- TODO: Does this belong here or in a similar file in the iasql_platform module?
CREATE
OR REPLACE FUNCTION iasql_audit () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if (TG_OP = 'INSERT') then
    INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change)
    VALUES (now(), SESSION_USER, TG_TABLE_NAME, 'INSERT', ('{"change":' || to_json(NEW.*) || '}')::json);
  elsif (TG_OP = 'DELETE') then
    INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change)
    VALUES (now(), SESSION_USER, TG_TABLE_NAME, 'DELETE', ('{"original":' || to_json(OLD.*) || '}')::json);
  elsif (TG_OP = 'UPDATE') then
    INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change)
    VALUES (now(), SESSION_USER, TG_TABLE_NAME, 'UPDATE', ('{"original":' || to_json(OLD.*) || ', "change":' || to_json(NEW.*) || '}')::json);
  end if;
  return NULL;
end;
$$;

-- picked from https://dba.stackexchange.com/questions/203934/postgresql-alternative-to-sql-server-s-try-cast-function
CREATE
OR REPLACE FUNCTION try_cast (_in TEXT, INOUT _out ANYELEMENT) LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
    execute format('SELECT %L::%s', $1, pg_typeof(_out))
    into  _out;
exception when others then
    -- do nothing: _out already carries default
end;
$$;

CREATE
OR REPLACE FUNCTION iasql_modules_installed () RETURNS TABLE (module_name TEXT, module_version TEXT, dependencies VARCHAR[]) LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  return query select
    split_part(name, '@', 1) as module_name,
    split_part(name, '@', 2) as module_version,
    array(select dependency from iasql_dependencies where module = name) as dependencies
  from iasql_module;
end;
$$;

COMMENT
  ON FUNCTION iasql_modules_installed () IS '{"description": "Returns list of currently installed modules", "sample_usage": "SELECT * FROM iasql_modules_installed()"}';

CREATE
OR REPLACE FUNCTION delete_all_records () RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  loop_count integer := 0;
  tables_array_length integer;
  tables_array text[];
  aux_tables_array text[];
BEGIN
  SELECT ARRAY(SELECT "table" FROM iasql_tables WHERE "table" != 'aws_credentials' AND "table" != 'aws_regions') INTO tables_array;
  SELECT array_length(tables_array, 1) INTO tables_array_length;
  WHILE tables_array_length > 0 AND loop_count < 20 LOOP
    SELECT tables_array INTO aux_tables_array;
    FOR table_elem IN array_lower(aux_tables_array, 1)..array_upper(aux_tables_array, 1) LOOP
      BEGIN
        EXECUTE format('DELETE FROM %I', aux_tables_array[table_elem]);
        SELECT array_remove(tables_array, aux_tables_array[table_elem]) INTO tables_array;
      EXCEPTION
        WHEN others THEN
          -- we ignore the error
        END;
    END LOOP;
    SELECT array_length(tables_array, 1) INTO tables_array_length;
    loop_count := loop_count + 1;
  END LOOP;
END;
$$;

CREATE
OR REPLACE FUNCTION iasql_version () RETURNS TABLE (VERSION TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  return query select split_part(name, '@', 2) as version from iasql_module limit 1;
end;
$$;

COMMENT
  ON FUNCTION iasql_version () IS '{"description": "Returns the IaSQL engine version", "sample_usage": "SELECT * FROM iasql_version()"}';

CREATE
OR REPLACE FUNCTION maybe_commit () RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
declare
    _change_type text;
    _ts TIMESTAMP WITH TIME ZONE;
    _5_hrs_interval TIMESTAMP WITH TIME ZONE;
    _almost_2_min_interval TIMESTAMP WITH TIME ZONE;
    _current_ts TIMESTAMP WITH TIME ZONE;
begin
    _current_ts := now();
    _5_hrs_interval := _current_ts - interval '5 hours';
    _almost_2_min_interval := _current_ts - interval '1.9 minutes';
    -- Check if theres an open transaction
    SELECT change_type, ts INTO _change_type, _ts
    FROM iasql_audit_log
    WHERE 
      change_type IN ('OPEN_TRANSACTION', 'CLOSE_TRANSACTION', 'START_COMMIT')
    ORDER BY ts DESC
    LIMIT 1;
    -- If latest log is START_COMMIT and have been running for more than 5hrs we assume something wrong happened 
    -- and we do a rollback to sync from cloud and close the commit
    IF _change_type = 'START_COMMIT' AND _ts IS NOT NULL AND _ts < _5_hrs_interval THEN
      PERFORM iasql_rollback(true);
      RETURN 'iasql_rollback called';
    END IF;
    -- If a transaction occurred less than 2 min ago we skip
    IF _change_type = 'CLOSE_TRANSACTION' AND (_ts IS NULL OR _ts < _almost_2_min_interval) THEN
      PERFORM iasql_begin();
      BEGIN
        PERFORM iasql_commit();
      EXCEPTION
        WHEN others THEN
          INSERT INTO iasql_audit_log (ts, "user", table_name, change_type, change, transaction_id)
          VALUES (clock_timestamp(), USER, 'iasql_audit_log', 'CLOSE_TRANSACTION', '{}'::json, 
            (SELECT transaction_id FROM iasql_audit_log WHERE change_type = 'OPEN_TRANSACTION' ORDER BY ts DESC LIMIT 1));
        END;
      RETURN 'iasql_commit called';
    ELSE
      RAISE EXCEPTION 'Cannot call iasql_commit while a transaction is open';
    END IF;
end;
$$;

CREATE
OR REPLACE FUNCTION query_cron (_action TEXT) RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
declare
    _db_id text;
    _dblink_conn_count int;
    _dblink_sql text;
    _out text;
begin
    SELECT current_database() INTO _db_id;
    SELECT count(1) INTO _dblink_conn_count
    FROM dblink_get_connections()
    WHERE dblink_get_connections@>'{iasqlcronconn}';
    IF _dblink_conn_count = 0 THEN
        PERFORM dblink_connect('iasqlcronconn', 'cron_dblink_' || _db_id);
    END IF;
    CASE
      WHEN _action = 'schedule' THEN
        -- TODO: scheduled function should check if is safe to run commit or if it is an open transaction in place
        _dblink_sql := format('SELECT schedule_in_database AS cron_res FROM cron.schedule_in_database (%L, %L, $CRON$ SELECT maybe_commit(); $CRON$, %L);', 'iasql_engine_' || _db_id, '*/2 * * * *', _db_id);
      WHEN _action = 'unschedule' THEN
        _dblink_sql := format('SELECT unschedule AS cron_res FROM cron.unschedule(%L);', 'iasql_engine_' || _db_id);
      WHEN _action = 'schedule_purge' THEN
        _dblink_sql := format('SELECT schedule AS cron_res FROM cron.schedule (%L, %L, $PURGE$ DELETE FROM cron.job_run_details WHERE database = %L AND end_time < (now() - interval %L); $PURGE$);', 'purge_iasql_engine_' || _db_id, '0 0 * * *', _db_id, '7 days');
      WHEN _action = 'unschedule_purge' THEN
        _dblink_sql := format('SELECT unschedule AS cron_res FROM cron.unschedule(%L);', 'purge_iasql_engine_' || _db_id);
      ELSE
        RAISE EXCEPTION 'Invalid action';
        RETURN 'Execution error';
    END CASE;
    -- allow statement that returns results in dblink https://stackoverflow.com/a/28299993
    WITH dblink_res as (
      SELECT * FROM dblink('iasqlcronconn', _dblink_sql) AS dblink_res(cron_res text)
    )
    SELECT dblink_res.cron_res INTO _out FROM dblink_res;
    -- give it some time to execute
    PERFORM pg_sleep(1);
    RETURN _out;
end;
$$;
