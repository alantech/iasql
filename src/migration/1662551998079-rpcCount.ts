import { MigrationInterface, QueryRunner } from 'typeorm';

export class rpcCount1662551998079 implements MigrationInterface {
  name = 'rpcCount1662551998079';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "rpc_count" integer NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "rpc_count"`);
  }
}
