import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcr1647369723609 implements MigrationInterface {
    name = 'awsEcr1647369723609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public_repository" ("id" SERIAL NOT NULL, "repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_5a7e30211ae44944c8cd65711dd" UNIQUE ("repository_name"), CONSTRAINT "PK_a0332b1b7f4244bc3d82f12000a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`);
        await queryRunner.query(`CREATE TABLE "repository" ("id" SERIAL NOT NULL, "repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "public"."repository_image_tag_mutability_enum" NOT NULL DEFAULT 'MUTABLE', "scan_on_push" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_8845a838de662324047b4a9bdd6" UNIQUE ("repository_name"), CONSTRAINT "PK_b842c26651c6fc0b9ccd1c530e2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "repository_id" integer NOT NULL, CONSTRAINT "REL_d3c217e991e59f7680624ccd1d" UNIQUE ("repository_id"), CONSTRAINT "PK_14f3e653f2de6dd234051222769" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_d3c217e991e59f7680624ccd1d5" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_d3c217e991e59f7680624ccd1d5"`);
        await queryRunner.query(`DROP TABLE "repository_policy"`);
        await queryRunner.query(`DROP TABLE "repository"`);
        await queryRunner.query(`DROP TYPE "public"."repository_image_tag_mutability_enum"`);
        await queryRunner.query(`DROP TABLE "public_repository"`);
    }

}
