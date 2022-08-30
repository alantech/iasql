import { MigrationInterface, QueryRunner } from 'typeorm';

export class upgradingFlag1660750886984 implements MigrationInterface {
  name = 'upgradingFlag1660750886984';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "upgrading" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "upgrading"`);
  }
}
