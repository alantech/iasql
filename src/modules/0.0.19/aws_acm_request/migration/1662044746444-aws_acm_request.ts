import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAcmRequest1662044746444 implements MigrationInterface {
    name = 'awsAcmRequest1662044746444'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."certificate_request_validation_method_enum" AS ENUM('DNS', 'EMAIL')`);
        await queryRunner.query(`CREATE TABLE "certificate_request" ("id" SERIAL NOT NULL, "arn" character varying, "domain_name" character varying NOT NULL, "domain_validation_options" json, "subject_alternative_names" text array, "validation_method" "public"."certificate_request_validation_method_enum" NOT NULL DEFAULT 'DNS', CONSTRAINT "PK_0a053bf5bbb0f21727b0120761e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "certificate_request"`);
        await queryRunner.query(`DROP TYPE "public"."certificate_request_validation_method_enum"`);
    }

}
