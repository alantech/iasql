import { MigrationInterface, QueryRunner } from 'typeorm';

export class initDbDirectConnect1648715192076 implements MigrationInterface {
  name = 'initDbDirectConnect1648715192076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "iasql_database" ADD "direct_connect" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "direct_connect"`);
  }
}
