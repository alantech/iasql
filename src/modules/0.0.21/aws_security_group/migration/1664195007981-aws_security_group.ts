import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSecurityGroup1664195007981 implements MigrationInterface {
  name = 'awsSecurityGroup1664195007981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "security_group" ("id" SERIAL NOT NULL, "description" character varying NOT NULL, "group_name" character varying NOT NULL, "owner_id" character varying, "group_id" character varying, "vpc_id" integer, CONSTRAINT "UQ_groupNameByVpc" UNIQUE ("group_name", "vpc_id"), CONSTRAINT "PK_08670ec0c305866dbfbfe004cb8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "security_group_rule" ("id" SERIAL NOT NULL, "security_group_rule_id" character varying, "is_egress" boolean NOT NULL, "ip_protocol" character varying, "from_port" integer, "to_port" integer, "cidr_ipv4" cidr, "cidr_ipv6" cidr, "prefix_list_id" character varying, "description" character varying, "security_group_id" integer, "source_security_group" integer, CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_id"), CONSTRAINT "Check_security_or_ip_permissions" CHECK (("source_security_group" IS NULL AND ("from_port" IS NOT NULL OR "to_port" IS NOT NULL OR "cidr_ipv4" IS NOT NULL OR "cidr_ipv6" IS NOT NULL)) OR ("source_security_group" IS NOT NULL AND (("from_port" IS NULL OR "from_port"=-1) AND ("to_port" IS NULL OR "to_port"=-1) AND ("cidr_ipv4" IS NULL OR "cidr_ipv4"='0.0.0.0/0') AND ("cidr_ipv6" IS NULL)))), CONSTRAINT "PK_f4c5f95331113ce4a2e1978a076" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group" ADD CONSTRAINT "FK_14629e5f1649053f9d33544acad" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_aebae570368c0606123496b0f90" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_6c6a7f58211fed8abb79e6c913f" FOREIGN KEY ("source_security_group") REFERENCES "security_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_6c6a7f58211fed8abb79e6c913f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_aebae570368c0606123496b0f90"`,
    );
    await queryRunner.query(`ALTER TABLE "security_group" DROP CONSTRAINT "FK_14629e5f1649053f9d33544acad"`);
    await queryRunner.query(`DROP TABLE "security_group_rule"`);
    await queryRunner.query(`DROP TABLE "security_group"`);
  }
}
