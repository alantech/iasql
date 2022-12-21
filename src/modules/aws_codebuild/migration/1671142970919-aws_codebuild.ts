import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCodebuild1671142970919 implements MigrationInterface {
  name = 'awsCodebuild1671142970919';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."codebuild_project_compute_type_enum" AS ENUM('BUILD_GENERAL1_SMALL', 'BUILD_GENERAL1_MEDIUM', 'BUILD_GENERAL1_LARGE', 'BUILD_GENERAL1_2XLARGE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codebuild_project_environment_type_enum" AS ENUM('ARM_CONTAINER', 'LINUX_CONTAINER', 'LINUX_GPU_CONTAINER', 'WINDOWS_CONTAINER', 'WINDOWS_SERVER_2019_CONTAINER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codebuild_project_source_type_enum" AS ENUM('GITHUB', 'CODEPIPELINE', 'NO_SOURCE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codebuild_project" ("id" SERIAL NOT NULL, "project_name" character varying NOT NULL, "arn" character varying, "build_spec" text, "source_location" character varying, "image" character varying NOT NULL DEFAULT 'aws/codebuild/standard:6.0', "compute_type" "public"."codebuild_project_compute_type_enum" NOT NULL DEFAULT 'BUILD_GENERAL1_SMALL', "environment_type" "public"."codebuild_project_environment_type_enum" NOT NULL DEFAULT 'LINUX_CONTAINER', "source_version" character varying, "source_type" "public"."codebuild_project_source_type_enum" NOT NULL, "environment_variables" text, "privileged_mode" boolean NOT NULL DEFAULT true, "region" character varying NOT NULL DEFAULT default_aws_region(), "service_role_name" character varying, CONSTRAINT "uq_codebuildproject_name_region" UNIQUE ("project_name", "region"), CONSTRAINT "uq_codebuildproject_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_7ad09b6ae15953c98345038ea57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codebuild_build_list_build_status_enum" AS ENUM('FAILED', 'FAULT', 'IN_PROGRESS', 'STOPPED', 'SUCCEEDED', 'TIMED_OUT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codebuild_build_list" ("id" SERIAL NOT NULL, "aws_id" character varying NOT NULL, "arn" character varying, "build_number" integer, "build_status" "public"."codebuild_build_list_build_status_enum" NOT NULL, "end_time" TIMESTAMP, "start_time" TIMESTAMP, "region" character varying NOT NULL DEFAULT default_aws_region(), "project_name" character varying, CONSTRAINT "uq_codebuildlist_name_region" UNIQUE ("aws_id", "region"), CONSTRAINT "uq_codebuildlist_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_50a7a7e05b0b8067c138324fa17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."source_credentials_list_source_type_enum" AS ENUM('GITHUB', 'CODEPIPELINE', 'NO_SOURCE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "source_credentials_list" ("arn" character varying NOT NULL, "source_type" "public"."source_credentials_list_source_type_enum" NOT NULL, "auth_type" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_8a8d9825b66a947e97685094d19" PRIMARY KEY ("arn"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_project" ADD CONSTRAINT "FK_75407540d48925c3555c05543c3" FOREIGN KEY ("service_role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_project" ADD CONSTRAINT "FK_7f9fd2d9eea87e92a9748b3bfa0" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_build_list" ADD CONSTRAINT "FK_a10d877414684a4c96249d4fa82" FOREIGN KEY ("project_name", "region") REFERENCES "codebuild_project"("project_name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_build_list" ADD CONSTRAINT "FK_6832b4b361539b03981122a1457" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_credentials_list" ADD CONSTRAINT "FK_cf3f27bc4e304c5edb53ed4794a" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_credentials_list" DROP CONSTRAINT "FK_cf3f27bc4e304c5edb53ed4794a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_build_list" DROP CONSTRAINT "FK_6832b4b361539b03981122a1457"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_build_list" DROP CONSTRAINT "FK_a10d877414684a4c96249d4fa82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_project" DROP CONSTRAINT "FK_7f9fd2d9eea87e92a9748b3bfa0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codebuild_project" DROP CONSTRAINT "FK_75407540d48925c3555c05543c3"`,
    );
    await queryRunner.query(`DROP TABLE "source_credentials_list"`);
    await queryRunner.query(`DROP TYPE "public"."source_credentials_list_source_type_enum"`);
    await queryRunner.query(`DROP TABLE "codebuild_build_list"`);
    await queryRunner.query(`DROP TYPE "public"."codebuild_build_list_build_status_enum"`);
    await queryRunner.query(`DROP TABLE "codebuild_project"`);
    await queryRunner.query(`DROP TYPE "public"."codebuild_project_source_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."codebuild_project_environment_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."codebuild_project_compute_type_enum"`);
  }
}
