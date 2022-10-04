import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCodedeploy1664862003813 implements MigrationInterface {
    name = 'awsCodedeploy1664862003813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum" AS ENUM('CodeDeployDefault.AllAtOnce', 'CodeDeployDefault.HalfAtATime', 'CodeDeployDefault.OneAtATime')`);
        await queryRunner.query(`CREATE TABLE "codedeploy_deployment_group" ("name" character varying NOT NULL, "id" character varying, "deployment_config_name" "public"."codedeploy_deployment_group_deployment_config_name_enum" NOT NULL DEFAULT 'CodeDeployDefault.OneAtATime', "ec2_tag_filters" json, "application_name" character varying NOT NULL, "role_name" character varying NOT NULL, CONSTRAINT "PK_db89898d1d24dc6b173c297372c" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "codedeploy_revision" ("id" SERIAL NOT NULL, "description" character varying, "location" json NOT NULL, "application_name" character varying NOT NULL, CONSTRAINT "PK_b97c7c23c17d53a777d0a44d49d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."codedeploy_application_compute_platform_enum" AS ENUM('Lambda', 'Server')`);
        await queryRunner.query(`CREATE TABLE "codedeploy_application" ("name" character varying NOT NULL, "id" character varying, "compute_platform" "public"."codedeploy_application_compute_platform_enum" NOT NULL DEFAULT 'Server', CONSTRAINT "PK_065aec2451add762a29370b65f4" PRIMARY KEY ("name"))`);
        await queryRunner.query(`ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_033ac438c1906805e21252415e5" FOREIGN KEY ("application_name") REFERENCES "codedeploy_application"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "codedeploy_deployment_group" ADD CONSTRAINT "FK_86e94742305aa3c507e978781ce" FOREIGN KEY ("role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "codedeploy_revision" ADD CONSTRAINT "FK_3acb71f43ea663377faea0debf4" FOREIGN KEY ("application_name") REFERENCES "codedeploy_application"("name") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "codedeploy_revision" DROP CONSTRAINT "FK_3acb71f43ea663377faea0debf4"`);
        await queryRunner.query(`ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_86e94742305aa3c507e978781ce"`);
        await queryRunner.query(`ALTER TABLE "codedeploy_deployment_group" DROP CONSTRAINT "FK_033ac438c1906805e21252415e5"`);
        await queryRunner.query(`DROP TABLE "codedeploy_application"`);
        await queryRunner.query(`DROP TYPE "public"."codedeploy_application_compute_platform_enum"`);
        await queryRunner.query(`DROP TABLE "codedeploy_revision"`);
        await queryRunner.query(`DROP TABLE "codedeploy_deployment_group"`);
        await queryRunner.query(`DROP TYPE "public"."codedeploy_deployment_group_deployment_config_name_enum"`);
    }

}
