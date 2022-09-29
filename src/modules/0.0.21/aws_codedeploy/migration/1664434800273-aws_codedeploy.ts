import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCodedeploy1664434800273 implements MigrationInterface {
  name = 'awsCodedeploy1664434800273';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_application_compute_platform_enum" AS ENUM('LAMBDA', 'SERVER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_application" ("application_name" character varying NOT NULL, "application_id" character varying, "compute_platform" "public"."codedeploy_application_compute_platform_enum" NOT NULL DEFAULT 'SERVER', CONSTRAINT "PK_dd6008aff60bef86c3cfdf5046f" PRIMARY KEY ("application_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "codedeploy_application"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_application_compute_platform_enum"`);
  }
}
