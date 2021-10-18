import {MigrationInterface, QueryRunner} from "typeorm";

export class ecrRepository1634566551756 implements MigrationInterface {
    name = 'ecrRepository1634566551756'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`);
        await queryRunner.query(`CREATE TABLE "repository" ("id" SERIAL NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "repository_name" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "repository_image_tag_mutability_enum", "scan_on_push" boolean, CONSTRAINT "PK_b842c26651c6fc0b9ccd1c530e2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "repository"`);
        await queryRunner.query(`DROP TYPE "repository_image_tag_mutability_enum"`);
    }

}
