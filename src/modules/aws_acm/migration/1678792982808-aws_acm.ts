import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAcm1678792982808 implements MigrationInterface {
  name = 'awsAcm1678792982808';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."certificate_certificate_type_enum" AS ENUM('AMAZON_ISSUED', 'IMPORTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."certificate_status_enum" AS ENUM('EXPIRED', 'FAILED', 'INACTIVE', 'ISSUED', 'PENDING_VALIDATION', 'REVOKED', 'VALIDATION_TIMED_OUT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."certificate_renewal_eligibility_enum" AS ENUM('ELIGIBLE', 'INELIGIBLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "certificate" ("id" SERIAL NOT NULL, "arn" character varying, "certificate_id" character varying, "domain_name" character varying NOT NULL, "certificate_type" "public"."certificate_certificate_type_enum", "status" "public"."certificate_status_enum", "renewal_eligibility" "public"."certificate_renewal_eligibility_enum", "in_use" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), "tags" json, CONSTRAINT "UQ_f863cd2ad563468a1aa9341384f" UNIQUE ("arn"), CONSTRAINT "PK_8daddfc65f59e341c2bbc9c9e43" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificate" ADD CONSTRAINT "FK_4b117343e5525ae6b754b679890" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "certificate" DROP CONSTRAINT "FK_4b117343e5525ae6b754b679890"`);
    await queryRunner.query(`DROP TABLE "certificate"`);
    await queryRunner.query(`DROP TYPE "public"."certificate_renewal_eligibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."certificate_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."certificate_certificate_type_enum"`);
  }
}
