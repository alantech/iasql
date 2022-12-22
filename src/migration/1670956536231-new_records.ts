import { MigrationInterface, QueryRunner } from 'typeorm';

import config from '../config';

export class newRecords1670956536231 implements MigrationInterface {
  name = 'newRecords1670956536231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "operation_count"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "rpc_count"`);
    await queryRunner.query(
      `ALTER TABLE "iasql_database" ADD "records_applied" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "records_synced" integer NOT NULL DEFAULT '0'`);
    // iasql_db_list
    await queryRunner.query(`
      drop function iasql_db_list;
      create or replace function iasql_db_list() returns table(
        pg_name varchar, alias varchar, record_count int, records_synced int, records_applied int, upgrading boolean, created_at timestamp, updated_at timestamp, pg_user varchar
      )
      language sql security definer
      as $$
        select
          id.pg_name, id.alias, id.record_count, id.records_synced, id.records_applied, id.upgrading, id.created_at, id.updated_at, id.pg_user
        from iasql_database id
        inner join iasql_user_databases iud on id.pg_name = iud.iasql_database_pg_name
        where iud.iasql_user_id = session_user
      $$;
    `);
    // iasql_connect
    await queryRunner.query(`
      drop function iasql_connect;
      create or replace function iasql_connect(db_alias varchar) returns table(
        "user" varchar, "password" varchar, record_count int, records_synced int, records_applied int, alias varchar, id varchar
      )
      language plpgsql security definer
      as $$
      declare
        _content text;
      begin
        perform http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3600000');
        select content into _content from http.http_post(
          'http://${config.http.host}:8088/v1/db/connect',
          json_build_object(
            'dbAlias', db_alias,
            'user', session_user
          )::text,
          'application/json'
        );
        if json_typeof(_content::json) = 'object' then
          return query select
            s."user", s."password", s.recordCount as record_count, s.recordsApplied as records_applied, s.recordsSynced as records_synced, s.alias, s.id
          from json_to_record(_content::json) as s(
            "user" varchar, "password" varchar, recordCount int, recordsSynced int, recordsSynced int, alias varchar, id varchar
          );
        else
          raise exception 'Bad response %', _content;
        end if;
      end;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "records_synced"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "records_applied"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "rpc_count" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(
      `ALTER TABLE "iasql_database" ADD "operation_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`
      drop function iasql_db_list;
      create or replace function iasql_db_list() returns table(
        pg_name varchar, alias varchar, record_count int, operation_count int, rpc_count int, upgrading boolean, created_at timestamp, updated_at timestamp, pg_user varchar
      )
      language sql security definer
      as $$
        select
          id.pg_name, id.alias, id.record_count, id.operation_count, id.rpc_count, id.upgrading, id.created_at, id.updated_at, id.pg_user
        from iasql_database id
        inner join iasql_user_databases iud on id.pg_name = iud.iasql_database_pg_name
        where iud.iasql_user_id = session_user
      $$;
    `);
    await queryRunner.query(`
      drop function iasql_connect;
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
          'http://${config.http.host}:8088/v1/db/connect',
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
    `);
  }
}
