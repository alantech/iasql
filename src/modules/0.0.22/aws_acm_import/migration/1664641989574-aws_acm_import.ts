import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAcmImport1664641989574 implements MigrationInterface {
  name = 'awsAcmImport1664641989574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "certificate_import" ("id" SERIAL NOT NULL, "certificate" character varying NOT NULL, "private_key" character varying NOT NULL, "chain" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_8cbbdc4878246d11a36a5639a04" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "certificate_import"`);
  }
}
