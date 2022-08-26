import { MigrationInterface, QueryRunner } from 'typeorm';

export class addIasqlDbOpCount1654134872777 implements MigrationInterface {
  name = 'addIasqlDbOpCount1654134872777';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "operation_count" integer NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "operation_count"`);
  }
}
