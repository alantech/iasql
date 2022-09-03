import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAccount1662162886014 implements MigrationInterface {
  name = 'awsAccount1662162886014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "aws_credentials" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, CONSTRAINT "PK_dd50eeb7ab9f2b49389ecd659f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "aws_regions" ("id" SERIAL NOT NULL, "region" character varying NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "is_enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_66b073aa74a50a1ec0f8e572901" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "aws_regions"`);
    await queryRunner.query(`DROP TABLE "aws_credentials"`);
  }
}
