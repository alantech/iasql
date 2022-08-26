import { MigrationInterface, QueryRunner } from 'typeorm';

export class dropDirectConnect1654079118383 implements MigrationInterface {
  name = 'dropDirectConnect1654079118383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "direct_connect"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "iasql_database" ADD "direct_connect" boolean NOT NULL DEFAULT false`
    );
  }
}
