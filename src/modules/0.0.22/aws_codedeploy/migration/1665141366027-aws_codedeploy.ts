import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCodedeploy1665141366027 implements MigrationInterface {
  name = 'awsCodedeploy1665141366027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "codedeploy_revision" ("id" SERIAL NOT NULL, "description" character varying, "location" json NOT NULL, "application_name" character varying NOT NULL, CONSTRAINT "PK_b97c7c23c17d53a777d0a44d49d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_application_compute_platform_enum" AS ENUM('Lambda', 'Server')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_application" ("name" character varying NOT NULL, "id" character varying, "compute_platform" "public"."codedeploy_application_compute_platform_enum" NOT NULL DEFAULT 'Server', CONSTRAINT "PK_065aec2451add762a29370b65f4" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_deployment_status_enum" AS ENUM('Baking', 'Created', 'Failed', 'InProgress', 'Queued', 'Ready', 'Stopped', 'Succeeded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_deployment" ("id" SERIAL NOT NULL, "deployment_id" character varying, "description" character varying, "external_id" character varying, "status" "public"."codedeploy_deployment_status_enum", "application_name" character varying NOT NULL, "deployment_group_name" character varying NOT NULL, "revision_id" integer, CONSTRAINT "UQ_b2f00b6e221c03dac7537468e99" UNIQUE ("deployment_id"), CONSTRAINT "REL_7d79572e71b3c68231b0d794a5" UNIQUE ("revision_id"), CONSTRAINT "PK_e0ac7fcb16e35c7fe3e90ad3dae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum" AS ENUM('CodeDeployDefault.AllAtOnce', 'CodeDeployDefault.HalfAtATime', 'CodeDeployDefault.OneAtATime')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_deployment_group" ("name" character varying NOT NULL, "id" character varying, "deployment_config_name" "public"."codedeploy_deployment_group_deployment_config_name_enum" NOT NULL DEFAULT 'CodeDeployDefault.OneAtATime', "ec2_tag_filters" json, "application_name" character varying NOT NULL, "role_name" character varying NOT NULL, CONSTRAINT "PK_db89898d1d24dc6b173c297372c" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_revision" ADD CONSTRAINT "FK_3acb71f43ea663377faea0debf4" FOREIGN KEY ("application_name") REFERENCES "codedeploy_application"("name") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_9a900c0a58c036a72f298476f27" FOREIGN KEY ("application_name") REFERENCES "codedeploy_application"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_869bece9c458ce053feba8496bb" FOREIGN KEY ("deployment_group_name") REFERENCES "codedeploy_deployment_group"("name") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_7d79572e71b3c68231b0d794a5a" FOREIGN KEY ("revision_id") REFERENCES "codedeploy_revision"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_033ac438c1906805e21252415e5" FOREIGN KEY ("application_name") REFERENCES "codedeploy_application"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_86e94742305aa3c507e978781ce" FOREIGN KEY ("role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_86e94742305aa3c507e978781ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_033ac438c1906805e21252415e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_7d79572e71b3c68231b0d794a5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_869bece9c458ce053feba8496bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_9a900c0a58c036a72f298476f27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_revision" DROP CONSTRAINT "FK_3acb71f43ea663377faea0debf4"`,
    );
    await queryRunner.query(`DROP TABLE "codedeploy_deployment_group"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum"`);
    await queryRunner.query(`DROP TABLE "codedeploy_deployment"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_deployment_status_enum"`);
    await queryRunner.query(`DROP TABLE "codedeploy_application"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_application_compute_platform_enum"`);
    await queryRunner.query(`DROP TABLE "codedeploy_revision"`);
  }
}
