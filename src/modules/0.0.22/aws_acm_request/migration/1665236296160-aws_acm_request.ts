import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAcmRequest1665236296160 implements MigrationInterface {
    name = 'awsAcmRequest1665236296160'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."certificate_request_validation_method_enum" AS ENUM('DNS', 'EMAIL')`);
        await queryRunner.query(`CREATE TABLE "certificate_request" ("id" SERIAL NOT NULL, "arn" character varying, "domain_name" character varying NOT NULL, "domain_validation_options" json, "subject_alternative_names" text array, "validation_method" "public"."certificate_request_validation_method_enum" NOT NULL DEFAULT 'DNS', "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_0a053bf5bbb0f21727b0120761e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "certificate_request" ADD CONSTRAINT "FK_d990e7226e7f05e91bdba99b27a" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificate_request" DROP CONSTRAINT "FK_d990e7226e7f05e91bdba99b27a"`);
        await queryRunner.query(`DROP TABLE "certificate_request"`);
        await queryRunner.query(`DROP TYPE "public"."certificate_request_validation_method_enum"`);
    }

}
