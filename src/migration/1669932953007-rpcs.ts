import { MigrationInterface, QueryRunner } from 'typeorm';

export class rpcs1669932953007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE SCHEMA http; CREATE EXTENSION http WITH SCHEMA http;

        create or replace function iasql_engine_health() returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          select content into _content from http.http_get('http://localhost:8088/health');
          return _content;
        end;
        $$;

        create or replace function iasql_version() returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          select content into _content from http.http_get('http://localhost:8088/v1/version');
          return _content;
        end;
        $$;

        create or replace function iasql_debug_error() returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          select content into _content from http.http_get('http://localhost:8088/debug-error');
          return _content;
        end;
        $$;

        create or replace function iasql_event(db_alias varchar(255), event_name varchar(255), button_alias varchar(255), sql text) returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          select content into _content from http.http_post(
            'http://localhost:8088/v1/db/event',
            json_build_object(
              'dbAlias', db_alias,
              'eventName', event_name,
              'buttonAlias', button_alias,
              'sql', sql,
              'user', session_user
            )::text,
            'application/json'
          );
          return _content;
        end;
        $$;

        create or replace function iasql_connect(db_alias varchar) returns table(
          "user" varchar, "password" varchar, record_count int, operation_count int, alias varchar, id varchar
        )
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
          select content into _content from http.http_post(
            'http://localhost:8088/v1/db/connect',
            json_build_object(
              'dbAlias', db_alias,
              'user', session_user
            )::text,
            'application/json'
          );
          if json_typeof(_content::json) = 'object' then
            return query select
              s."user", s."password", s.recordCount as record_count, s.operationCount as operation_count, s.alias, s.id
            from json_to_record(_content::json) as s(
              "user" varchar, "password" varchar, recordCount int, operationCount int, alias varchar, id varchar
            );
          else
            raise exception 'Bad response %', _content;
          end if;
        end;
        $$;

        create or replace function iasql_disconnect(db_alias varchar(255)) returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
          select content into _content from http.http_post(
            'http://localhost:8088/v1/db/disconnect',
            json_build_object(
              'dbAlias', db_alias,
              'user', session_user
            )::text,
            'application/json'
          );
          return _content;
        end;
        $$;

        create or replace function iasql_export(db_alias varchar(255), data_only boolean) returns text
        language plpgsql security definer
        as $$
        declare
          _content text;
        begin
          perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
          select content into _content from http.http_post(
            'http://localhost:8088/v1/db/export',
            json_build_object(
              'dbAlias', db_alias,
              'dataOnly', data_only,
              'user', session_user
            )::text,
            'application/json'
          );
          return _content;
        end;
        $$;

        create or replace function iasql_db_list() returns table(
          pg_name varchar, alias varchar, record_count int, operation_count int, rpc_count int, upgrading boolean, created_at timestamp, updated_at timestamp
        )
        language sql security definer
        as $$
          select
            id.pg_name, id.alias, id.record_count, id.operation_count, id.rpc_count, id.upgrading, id.created_at, id.updated_at
          from iasql_database id
          inner join iasql_user_databases iud on id.pg_name = iud.iasql_database_pg_name
          where iud.iasql_user_id = session_user
        $$;
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        -- drop function iasql_db_list;
        drop function iasql_export;
        drop function iasql_disconnect;
        drop function iasql_connect;
        drop function iasql_event;
        drop function iasql_debug_error;
        drop function iasql_version;
        drop function iasql_engine_health;
        drop extension http;
        drop schema http;
      `);
  }
}
