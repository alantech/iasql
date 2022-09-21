import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCodebuild1663773220784 implements MigrationInterface {
    name = 'awsCodebuild1663773220784'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."codebuild_project_compute_type_enum" AS ENUM('BUILD_GENERAL1_SMALL', 'BUILD_GENERAL1_MEDIUM', 'BUILD_GENERAL1_LARGE', 'BUILD_GENERAL1_2XLARGE')`);
        await queryRunner.query(`CREATE TYPE "public"."codebuild_project_environment_type_enum" AS ENUM('ARM_CONTAINER', 'LINUX_CONTAINER', 'LINUX_GPU_CONTAINER', 'WINDOWS_CONTAINER', 'WINDOWS_SERVER_2019_CONTAINER')`);
        await queryRunner.query(`CREATE TYPE "public"."codebuild_project_source_type_enum" AS ENUM('GITHUB')`);
        await queryRunner.query(`CREATE TABLE "codebuild_project" ("project_name" character varying NOT NULL, "arn" character varying, "build_spec" text, "source_location" character varying NOT NULL, "image" character varying NOT NULL DEFAULT 'aws/codebuild/standard:6.0', "compute_type" "public"."codebuild_project_compute_type_enum" NOT NULL DEFAULT 'BUILD_GENERAL1_SMALL', "environment_type" "public"."codebuild_project_environment_type_enum" NOT NULL DEFAULT 'LINUX_CONTAINER', "source_version" character varying, "source_type" "public"."codebuild_project_source_type_enum" NOT NULL, "environment_variables" text, "privileged_mode" boolean NOT NULL DEFAULT true, "service_role_name" character varying, CONSTRAINT "PK_0e95444784d749e68a3c5cf8b7c" PRIMARY KEY ("project_name"))`);
        await queryRunner.query(`CREATE TYPE "public"."source_credentials_list_source_type_enum" AS ENUM('GITHUB')`);
        await queryRunner.query(`CREATE TABLE "source_credentials_list" ("arn" character varying NOT NULL, "source_type" "public"."source_credentials_list_source_type_enum" NOT NULL, "auth_type" character varying NOT NULL, CONSTRAINT "PK_8a8d9825b66a947e97685094d19" PRIMARY KEY ("arn"))`);
        await queryRunner.query(`CREATE TYPE "public"."source_credentials_import_source_type_enum" AS ENUM('GITHUB')`);
        await queryRunner.query(`CREATE TYPE "public"."source_credentials_import_auth_type_enum" AS ENUM('PERSONAL_ACCESS_TOKEN')`);
        await queryRunner.query(`CREATE TABLE "source_credentials_import" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "source_type" "public"."source_credentials_import_source_type_enum" NOT NULL, "auth_type" "public"."source_credentials_import_auth_type_enum" NOT NULL, CONSTRAINT "PK_c1c5d499fdba24ff5ac63f3002c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."codebuild_build_list_build_status_enum" AS ENUM('FAILED', 'FAULT', 'IN_PROGRESS', 'STOPPED', 'SUCCEEDED', 'TIMED_OUT')`);
        await queryRunner.query(`CREATE TABLE "codebuild_build_list" ("id" character varying NOT NULL, "arn" character varying, "build_number" integer, "build_status" "public"."codebuild_build_list_build_status_enum" NOT NULL, "end_time" TIMESTAMP, "start_time" TIMESTAMP, "project_name" character varying, CONSTRAINT "PK_50a7a7e05b0b8067c138324fa17" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "codebuild_build_import" ("id" SERIAL NOT NULL, "project_name" character varying, CONSTRAINT "PK_4ea8c3dad42dee7fddcf905f35f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "codebuild_project" ADD CONSTRAINT "FK_75407540d48925c3555c05543c3" FOREIGN KEY ("service_role_name") REFERENCES "role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "codebuild_build_list" ADD CONSTRAINT "FK_260ab6704f473a4323d955d39d5" FOREIGN KEY ("project_name") REFERENCES "codebuild_project"("project_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "codebuild_build_import" ADD CONSTRAINT "FK_828909988ef3e5bf3ef87f52682" FOREIGN KEY ("project_name") REFERENCES "codebuild_project"("project_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "codebuild_build_import" DROP CONSTRAINT "FK_828909988ef3e5bf3ef87f52682"`);
        await queryRunner.query(`ALTER TABLE "codebuild_build_list" DROP CONSTRAINT "FK_260ab6704f473a4323d955d39d5"`);
        await queryRunner.query(`ALTER TABLE "codebuild_project" DROP CONSTRAINT "FK_75407540d48925c3555c05543c3"`);
        await queryRunner.query(`DROP TABLE "codebuild_build_import"`);
        await queryRunner.query(`DROP TABLE "codebuild_build_list"`);
        await queryRunner.query(`DROP TYPE "public"."codebuild_build_list_build_status_enum"`);
        await queryRunner.query(`DROP TABLE "source_credentials_import"`);
        await queryRunner.query(`DROP TYPE "public"."source_credentials_import_auth_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."source_credentials_import_source_type_enum"`);
        await queryRunner.query(`DROP TABLE "source_credentials_list"`);
        await queryRunner.query(`DROP TYPE "public"."source_credentials_list_source_type_enum"`);
        await queryRunner.query(`DROP TABLE "codebuild_project"`);
        await queryRunner.query(`DROP TYPE "public"."codebuild_project_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."codebuild_project_environment_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."codebuild_project_compute_type_enum"`);
    }

}
