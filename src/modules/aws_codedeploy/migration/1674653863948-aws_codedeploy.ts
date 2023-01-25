import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCodedeploy1674653863948 implements MigrationInterface {
  name = 'awsCodedeploy1674653863948';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum" AS ENUM('CodeDeployDefault.AllAtOnce', 'CodeDeployDefault.HalfAtATime', 'CodeDeployDefault.OneAtATime', 'CodeDeployDefault.LambdaCanary10Percent5Minutes', 'CodeDeployDefault.LambdaCanary10Percent10Minutes', 'CodeDeployDefault.LambdaCanary10Percent15Minutes', 'CodeDeployDefault.LambdaCanary10Percent30Minutes', 'CodeDeployDefault.LambdaLinear10Percent1Minute', 'CodeDeployDefault.LambdaLinear10Percent2Minutes', 'CodeDeployDefault.LambdaLinear10Percent3Minutes', 'CodeDeployDefault.LambdaLinear10Percent10Minutes', 'CodeDeployDefault.LambdaAllAtOnce')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_deployment_group" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "deployment_group_id" character varying, "deployment_config_name" "public"."codedeploy_deployment_group_deployment_config_name_enum" NOT NULL DEFAULT 'CodeDeployDefault.OneAtATime', "deployment_style" json, "ec2_tag_filters" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "application_id" integer NOT NULL, "role_name" character varying, CONSTRAINT "uq_codedeploydeploymentgroup_name_region" UNIQUE ("name", "region"), CONSTRAINT "uq_codedeploydeploymentgroup_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_ea09374ec42c1295acd077974e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_application_compute_platform_enum" AS ENUM('Lambda', 'Server')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_application" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "application_id" character varying, "compute_platform" "public"."codedeploy_application_compute_platform_enum" NOT NULL DEFAULT 'Server', "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_codedeployapp_name_region" UNIQUE ("name", "region"), CONSTRAINT "uq_codedeployapp_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_42c16c725b20d9fbdf30339f8bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."codedeploy_deployment_status_enum" AS ENUM('Baking', 'Created', 'Failed', 'InProgress', 'Queued', 'Ready', 'Stopped', 'Succeeded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "codedeploy_deployment" ("id" SERIAL NOT NULL, "deployment_id" character varying, "description" character varying, "external_id" character varying, "status" "public"."codedeploy_deployment_status_enum", "location" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "application_id" integer NOT NULL, "deployment_group_id" integer NOT NULL, CONSTRAINT "UQ_b2f00b6e221c03dac7537468e99" UNIQUE ("deployment_id"), CONSTRAINT "uq_codedeploydeployment_deploymentid_region" UNIQUE ("deployment_id", "region"), CONSTRAINT "uq_codedeploydeployment_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_e0ac7fcb16e35c7fe3e90ad3dae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_3fd1513a816c8cad7a3e62519f6" FOREIGN KEY ("application_id", "region") REFERENCES "codedeploy_application"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_86e94742305aa3c507e978781ce" FOREIGN KEY ("role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_0983ef333da0168f34e87e72b32" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_application" ADD CONSTRAINT "FK_f820df507134d1736992802d0db" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_a20a22b2ee48d5f03b5889e76fa" FOREIGN KEY ("application_id", "region") REFERENCES "codedeploy_application"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_e76b3be885949c3ce29f2d50f21" FOREIGN KEY ("deployment_group_id", "region") REFERENCES "codedeploy_deployment_group"("id","region") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" ADD CONSTRAINT "FK_c4baee0ec0b71487b5ebffd60a5" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_c4baee0ec0b71487b5ebffd60a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_e76b3be885949c3ce29f2d50f21"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment" DROP CONSTRAINT "FK_a20a22b2ee48d5f03b5889e76fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_application" DROP CONSTRAINT "FK_f820df507134d1736992802d0db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_0983ef333da0168f34e87e72b32"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_86e94742305aa3c507e978781ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_3fd1513a816c8cad7a3e62519f6"`,
    );
    await queryRunner.query(`DROP TABLE "codedeploy_deployment"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_deployment_status_enum"`);
    await queryRunner.query(`DROP TABLE "codedeploy_application"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_application_compute_platform_enum"`);
    await queryRunner.query(`DROP TABLE "codedeploy_deployment_group"`);
    await queryRunner.query(`DROP TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum"`);
  }
}
