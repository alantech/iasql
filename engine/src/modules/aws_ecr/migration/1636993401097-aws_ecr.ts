import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcr1636993401097 implements MigrationInterface {
    name = 'awsEcr1636993401097'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "aws_repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`);
        await queryRunner.query(`CREATE TABLE "aws_repository" ("id" SERIAL NOT NULL, "repository_name" character varying, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "aws_repository_image_tag_mutability_enum", "scan_on_push" boolean, CONSTRAINT "UQ_31c92f2fb5f203bdb05ada24d7a" UNIQUE ("repository_name"), CONSTRAINT "PK_06daa56b29fd9c69b862f276565" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "repository_id" integer, CONSTRAINT "REL_8d4c5993e3cea3212a32ade4b4" UNIQUE ("repository_id"), CONSTRAINT "PK_e05f9b7b2b063e0b1e11d6400b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_repository_policy" ADD CONSTRAINT "FK_8d4c5993e3cea3212a32ade4b41" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_repository_policy" DROP CONSTRAINT "FK_8d4c5993e3cea3212a32ade4b41"`);
        await queryRunner.query(`DROP TABLE "aws_repository_policy"`);
        await queryRunner.query(`DROP TABLE "aws_repository"`);
        await queryRunner.query(`DROP TYPE "aws_repository_image_tag_mutability_enum"`);
    }

}
