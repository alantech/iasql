import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCloudfront1660846433388 implements MigrationInterface {
    name = 'awsCloudfront1660846433388'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "distribution" ("id" SERIAL NOT NULL, "distribution_id" character varying, "caller_reference" character varying, "comment" character varying, "enabled" boolean, "is_ipv6_enabled" boolean, "web_acl_id" character varying, "default_cache_behavior" json NOT NULL, "origins" json NOT NULL, CONSTRAINT "PK_187eaf203ccf9018df51b40108c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."distribution_metadata_status_enum" AS ENUM('InProgress', 'Deployed')`);
        await queryRunner.query(`CREATE TABLE "distribution_metadata" ("id" SERIAL NOT NULL, "arn" character varying, "domain_name" character varying, "status" "public"."distribution_metadata_status_enum", "distribution_id" integer NOT NULL, CONSTRAINT "REL_b89b3ba56beea258c1535775c8" UNIQUE ("distribution_id"), CONSTRAINT "PK_94452d8e9fc7d045530c2272e2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "distribution_metadata" ADD CONSTRAINT "FK_b89b3ba56beea258c1535775c84" FOREIGN KEY ("distribution_id") REFERENCES "distribution"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "distribution_metadata" DROP CONSTRAINT "FK_b89b3ba56beea258c1535775c84"`);
        await queryRunner.query(`DROP TABLE "distribution_metadata"`);
        await queryRunner.query(`DROP TYPE "public"."distribution_metadata_status_enum"`);
        await queryRunner.query(`DROP TABLE "distribution"`);
    }

}
