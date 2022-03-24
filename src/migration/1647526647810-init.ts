import {MigrationInterface, QueryRunner} from "typeorm";

export class init1647526647810 implements MigrationInterface {
    name = 'init1647526647810'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "iasql_module" ("name" character varying NOT NULL, CONSTRAINT "UQ_e91a0b0e9a029428405fdd17ee4" UNIQUE ("name"), CONSTRAINT "PK_e91a0b0e9a029428405fdd17ee4" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "iasql_tables" ("table" character varying NOT NULL, "module" character varying NOT NULL, CONSTRAINT "PK_2e2832f9cf90115571eb803a943" PRIMARY KEY ("table", "module"))`);
        await queryRunner.query(`CREATE TYPE "public"."iasql_operation_optype_enum" AS ENUM('APPLY', 'SYNC', 'INSTALL', 'UNINSTALL', 'PLAN')`);
        await queryRunner.query(`CREATE TABLE "iasql_operation" ("opid" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE, "optype" "public"."iasql_operation_optype_enum" NOT NULL, "params" text array NOT NULL, "output" text, "err" text, CONSTRAINT "PK_edf11c327fef1bf78dd04cdf3ce" PRIMARY KEY ("opid"))`);
        await queryRunner.query(`CREATE TABLE "iasql_dependencies" ("module" character varying NOT NULL, "dependency" character varying NOT NULL, CONSTRAINT "PK_b07797cfc364fa84b6da165f89d" PRIMARY KEY ("module", "dependency"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9732df6d7dff34b6f6a1732033" ON "iasql_dependencies" ("module") `);
        await queryRunner.query(`CREATE INDEX "IDX_7dbdaef2c45fdd0d1d82cc9568" ON "iasql_dependencies" ("dependency") `);
        await queryRunner.query(`ALTER TABLE "iasql_tables" ADD CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb" FOREIGN KEY ("module") REFERENCES "iasql_module"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b" FOREIGN KEY ("module") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c" FOREIGN KEY ("dependency") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`
            create or replace function until_iasql_operation(_optype iasql_operation_optype_enum, _params text[]) returns uuid
            language plpgsql
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
                            raise notice '% succeeded', _optype
                            using detail = _output;
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
        `);
        await queryRunner.query(`
            create or replace function iasql_apply() returns void
            language plpgsql
            as $$
            begin
                perform until_iasql_operation('APPLY', array[]::text[]);
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace function iasql_plan() returns void
            language plpgsql
            as $$
            begin
                perform until_iasql_operation('PLAN', array[]::text[]);
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace function iasql_sync() returns void
            language plpgsql
            as $$
            begin
                perform until_iasql_operation('SYNC', array[]::text[]);
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace function iasql_install(_mods text[]) returns table (
              module_name character varying,
              table_name character varying,
              record_count int
            )
            language plpgsql
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
        `);
        await queryRunner.query(`
            create or replace function iasql_install(_mod text) returns table (
              module_name character varying,
              table_name character varying,
              record_count int
            )
            language plpgsql
            as $$
            begin
                perform until_iasql_operation('INSTALL', array[_mod]);
                return query select
                  m.name as module_name,
                  t.table as table_name,
                  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
                from iasql_module as m
                inner join iasql_tables as t on m.name = t.module
                where m.name = _mod;
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace function iasql_uninstall(_mods text[]) returns table (
              module_name character varying,
              table_name character varying,
              record_count int
            )
            language plpgsql
            as $$
            declare
              _out record;
            begin
                select
                  m.name as module_name,
                  t.table as table_name,
                  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
                into _out
                from iasql_module as m
                inner join iasql_tables as t on m.name = t.module
                where m.name = any (_mods);
                perform until_iasql_operation('UNINSTALL', _mods);
                return query select * from _out;
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace function iasql_uninstall(_mod text) returns table (
              module_name character varying,
              table_name character varying,
              record_count int
            )
            language plpgsql
            as $$
            declare
              _out record;
            begin
                select
                  m.name as module_name,
                  t.table as table_name,
                  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
                into _out
                from iasql_module as m
                inner join iasql_tables as t on m.name = t.module
                where m.name = _mod;
                perform until_iasql_operation('UNINSTALL', array[_mod]);
                return query select * from _out;
            end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP FUNCTION "iasql_uninstall(text[])"`);
        await queryRunner.query(`DROP FUNCTION "iasql_uninstall(text)"`);
        await queryRunner.query(`DROP FUNCTION "iasql_install(text[])"`);
        await queryRunner.query(`DROP FUNCTION "iasql_install(text)"`);
        await queryRunner.query(`DROP FUNCTION "iasql_sync"`);
        await queryRunner.query(`DROP FUNCTION "iasql_plan"`);
        await queryRunner.query(`DROP FUNCTION "iasql_apply"`);
        await queryRunner.query(`DROP FUNCTION "until_iasql_operation"`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c"`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b"`);
        await queryRunner.query(`ALTER TABLE "iasql_tables" DROP CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7dbdaef2c45fdd0d1d82cc9568"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9732df6d7dff34b6f6a1732033"`);
        await queryRunner.query(`DROP TABLE "iasql_dependencies"`);
        await queryRunner.query(`DROP TABLE "iasql_operation"`);
        await queryRunner.query(`DROP TYPE "public"."iasql_operation_optype_enum"`);
        await queryRunner.query(`DROP TABLE "iasql_tables"`);
        await queryRunner.query(`DROP TABLE "iasql_module"`);
    }

}
