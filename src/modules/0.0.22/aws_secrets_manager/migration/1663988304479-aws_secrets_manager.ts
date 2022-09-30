import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSecretsManager1663988304479 implements MigrationInterface {
  name = 'awsSecretsManager1663988304479';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "secret" ("name" character varying NOT NULL, "description" character varying, "value" character varying, "version_id" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_f05861f3e072021bda08543eb4c" PRIMARY KEY ("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "secret"`);
  }
}
