import { MigrationInterface, QueryRunner } from 'typeorm';

export class recordCount1649864745475 implements MigrationInterface {
  name = 'recordCount1649864745475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "record_count" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "iasql_user" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "iasql_user" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_user" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "iasql_user" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "record_count"`);
  }
}
