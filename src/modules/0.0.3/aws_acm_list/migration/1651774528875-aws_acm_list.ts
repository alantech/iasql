import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAcmList1651774528875 implements MigrationInterface {
    name = 'awsAcmList1651774528875'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."certificate_certificate_type_enum" AS ENUM('AMAZON_ISSUED', 'IMPORTED')`);
        await queryRunner.query(`CREATE TYPE "public"."certificate_status_enum" AS ENUM('EXPIRED', 'FAILED', 'INACTIVE', 'ISSUED', 'PENDING_VALIDATION', 'REVOKED', 'VALIDATION_TIMED_OUT')`);
        await queryRunner.query(`CREATE TYPE "public"."certificate_renewal_eligibility_enum" AS ENUM('ELIGIBLE', 'INELIGIBLE')`);
        await queryRunner.query(`CREATE TABLE "certificate" ("id" SERIAL NOT NULL, "arn" character varying, "certificate_id" character varying, "domain_name" character varying NOT NULL, "certificate_type" "public"."certificate_certificate_type_enum", "status" "public"."certificate_status_enum", "renewal_eligibility" "public"."certificate_renewal_eligibility_enum", "in_use" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8daddfc65f59e341c2bbc9c9e43" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "PK_9ad897024d8c36c541d7fe84084" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "aws_account"`);
        await queryRunner.query(`DROP TABLE "certificate"`);
        await queryRunner.query(`DROP TYPE "public"."certificate_renewal_eligibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."certificate_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."certificate_certificate_type_enum"`);
    }

}
