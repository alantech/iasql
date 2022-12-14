import { MigrationInterface, QueryRunner } from 'typeorm';

export class updateIasqlDbList1670872677486 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop function iasql_db_list;
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
}
