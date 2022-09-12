import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAcmRequest1662965011103 implements MigrationInterface {
  name = 'awsAcmRequest1662965011103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "load_balancer" DROP CONSTRAINT "check_load_balancer_availability_zones"`,
    );
    await queryRunner.query(`ALTER TABLE "load_balancer" DROP CONSTRAINT "check_load_balancer_subnets"`);
    await queryRunner.query(
      `CREATE TYPE "public"."certificate_request_validation_method_enum" AS ENUM('DNS', 'EMAIL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "certificate_request" ("id" SERIAL NOT NULL, "arn" character varying, "domain_name" character varying NOT NULL, "domain_validation_options" json, "subject_alternative_names" text array, "validation_method" "public"."certificate_request_validation_method_enum" NOT NULL DEFAULT 'DNS', CONSTRAINT "PK_0a053bf5bbb0f21727b0120761e" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "certificate_request"`);
    await queryRunner.query(`DROP TYPE "public"."certificate_request_validation_method_enum"`);
    await queryRunner.query(
      `ALTER TABLE "load_balancer" ADD CONSTRAINT "check_load_balancer_subnets" CHECK (check_load_balancer_subnets((subnets)::text[]))`,
    );
    await queryRunner.query(
      `ALTER TABLE "load_balancer" ADD CONSTRAINT "check_load_balancer_availability_zones" CHECK (check_load_balancer_availability_zones(load_balancer_name, availability_zones))`,
    );
  }
}
