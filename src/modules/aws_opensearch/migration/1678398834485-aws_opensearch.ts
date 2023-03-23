import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsOpensearch1678398834485 implements MigrationInterface {
  name = 'awsOpensearch1678398834485';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."domain_deployment_type_enum" AS ENUM('PRODUCTION', 'DEVELOPMENT_AND_TESTING', 'CUSTOM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "domain" ("id" SERIAL NOT NULL, "domain_name" character varying NOT NULL, "custom_endpoint" character varying, "deployment_type" "public"."domain_deployment_type_enum" NOT NULL DEFAULT 'DEVELOPMENT_AND_TESTING', "version" character varying NOT NULL, "availability_zone_count" integer NOT NULL, "instance_type" character varying NOT NULL, "instance_count" integer NOT NULL, "ebs_options" jsonb, "warm_instance_type" character varying, "warm_instance_count" integer, "cold_storage" boolean DEFAULT false, "dedicated_master_type" character varying, "dedicated_master_count" integer, "auto_tune" boolean NOT NULL DEFAULT true, "enable_fine_grained_access_control" boolean NOT NULL DEFAULT false, "fine_grained_access_control_user_arn" character varying, "fine_grained_access_control_master_username" character varying, "fine_grained_access_control_master_password" character varying, "access_policy" jsonb NOT NULL, "endpoint" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "endpoint_certificate_id" integer, CONSTRAINT "PK_27e3ec3ea0ae02c8c5bceab3ba9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "domain_subnets" ("domain_id" integer NOT NULL, "subnet_id" integer NOT NULL, CONSTRAINT "PK_642b5f1b64f643e6caadcd4859c" PRIMARY KEY ("domain_id", "subnet_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c39c8bb0bd855c5dc210fafe1e" ON "domain_subnets" ("domain_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ed6ec783048c6f2509ab853514" ON "domain_subnets" ("subnet_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "domain_security_groups" ("domain_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_eff015acc146c35922ba0b12b69" PRIMARY KEY ("domain_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aff590de909aaaee0fe17b9869" ON "domain_security_groups" ("domain_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_925f41ff0a36b13bf0089ea06f" ON "domain_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domain" ADD CONSTRAINT "FK_f4e55c54dfa7b0587eca3a139d3" FOREIGN KEY ("endpoint_certificate_id") REFERENCES "certificate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain" ADD CONSTRAINT "FK_377962928e56e1b375b63f82e25" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain_subnets" ADD CONSTRAINT "FK_c39c8bb0bd855c5dc210fafe1ec" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain_subnets" ADD CONSTRAINT "FK_ed6ec783048c6f2509ab8535140" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain_security_groups" ADD CONSTRAINT "FK_aff590de909aaaee0fe17b98694" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain_security_groups" ADD CONSTRAINT "FK_925f41ff0a36b13bf0089ea06fc" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domain_security_groups" DROP CONSTRAINT "FK_925f41ff0a36b13bf0089ea06fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "domain_security_groups" DROP CONSTRAINT "FK_aff590de909aaaee0fe17b98694"`,
    );
    await queryRunner.query(`ALTER TABLE "domain_subnets" DROP CONSTRAINT "FK_ed6ec783048c6f2509ab8535140"`);
    await queryRunner.query(`ALTER TABLE "domain_subnets" DROP CONSTRAINT "FK_c39c8bb0bd855c5dc210fafe1ec"`);
    await queryRunner.query(`ALTER TABLE "domain" DROP CONSTRAINT "FK_377962928e56e1b375b63f82e25"`);
    await queryRunner.query(`ALTER TABLE "domain" DROP CONSTRAINT "FK_f4e55c54dfa7b0587eca3a139d3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_925f41ff0a36b13bf0089ea06f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aff590de909aaaee0fe17b9869"`);
    await queryRunner.query(`DROP TABLE "domain_security_groups"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ed6ec783048c6f2509ab853514"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c39c8bb0bd855c5dc210fafe1e"`);
    await queryRunner.query(`DROP TABLE "domain_subnets"`);
    await queryRunner.query(`DROP TABLE "domain"`);
    await queryRunner.query(`DROP TYPE "public"."domain_deployment_type_enum"`);
  }
}
