import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcr1663952521162 implements MigrationInterface {
    name = 'awsEcr1663952521162'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "repository_image" ("image_id" character varying NOT NULL, "image_digest" character varying NOT NULL, "image_tag" character varying NOT NULL, "registry_id" character varying, "private_repository" character varying, "private_repository_region" character varying, "public_repository" character varying, CONSTRAINT "PK_95b2f828d40910528ca2fe72a0a" PRIMARY KEY ("image_id"))`);
        await queryRunner.query(`CREATE TABLE "public_repository" ("repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5a7e30211ae44944c8cd65711dd" PRIMARY KEY ("repository_name"))`);
        await queryRunner.query(`CREATE TYPE "public"."repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`);
        await queryRunner.query(`CREATE TABLE "repository" ("repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "public"."repository_image_tag_mutability_enum" NOT NULL DEFAULT 'MUTABLE', "scan_on_push" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_8845a838de662324047b4a9bdd6" PRIMARY KEY ("repository_name"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d8ebc33bfa675482f550961506" ON "repository" ("repository_name", "region") `);
        await queryRunner.query(`CREATE TABLE "repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "repository_name" character varying NOT NULL, CONSTRAINT "REL_06da26d302fd4774e21181d3d6" UNIQUE ("repository_name", "region"), CONSTRAINT "PK_14f3e653f2de6dd234051222769" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_48baab7da5512ceed62193dde0" ON "repository_policy" ("id", "region") `);
        await queryRunner.query(`ALTER TABLE "repository_image" ADD CONSTRAINT "FK_d04e4476fcd80553c1a73f9811d" FOREIGN KEY ("private_repository", "private_repository_region") REFERENCES "repository"("repository_name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "repository_image" ADD CONSTRAINT "FK_73e200bf737f9171cf79db50514" FOREIGN KEY ("public_repository") REFERENCES "public_repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_06da26d302fd4774e21181d3d6c" FOREIGN KEY ("repository_name", "region") REFERENCES "repository"("repository_name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_06da26d302fd4774e21181d3d6c"`);
        await queryRunner.query(`ALTER TABLE "repository_image" DROP CONSTRAINT "FK_73e200bf737f9171cf79db50514"`);
        await queryRunner.query(`ALTER TABLE "repository_image" DROP CONSTRAINT "FK_d04e4476fcd80553c1a73f9811d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48baab7da5512ceed62193dde0"`);
        await queryRunner.query(`DROP TABLE "repository_policy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8ebc33bfa675482f550961506"`);
        await queryRunner.query(`DROP TABLE "repository"`);
        await queryRunner.query(`DROP TYPE "public"."repository_image_tag_mutability_enum"`);
        await queryRunner.query(`DROP TABLE "public_repository"`);
        await queryRunner.query(`DROP TABLE "repository_image"`);
    }

}
