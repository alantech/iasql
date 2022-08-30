import { MigrationInterface, QueryRunner } from 'typeorm';

export class dropColumnsFromMetadataTracking1650987684042 implements MigrationInterface {
  name = 'dropColumnsFromMetadataTracking1650987684042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "region"`);
    await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "is_ready"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "is_ready" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "iasql_database" ADD "region" character varying NOT NULL`);
  }
}
