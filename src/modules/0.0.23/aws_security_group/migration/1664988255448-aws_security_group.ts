import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSecurityGroup1664988255448 implements MigrationInterface {
  name = 'awsSecurityGroup1664988255448';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "security_group" ("id" SERIAL NOT NULL, "description" character varying NOT NULL, "group_name" character varying NOT NULL, "owner_id" character varying, "group_id" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "vpc_id" integer, CONSTRAINT "uq_security_group_region" UNIQUE ("id", "region"), CONSTRAINT "UQ_groupNameByVpc" UNIQUE ("group_name", "vpc_id", "region"), CONSTRAINT "PK_08670ec0c305866dbfbfe004cb8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "security_group_rule" ("id" SERIAL NOT NULL, "security_group_rule_id" character varying, "is_egress" boolean NOT NULL, "ip_protocol" character varying, "from_port" integer, "to_port" integer, "cidr_ipv4" cidr, "cidr_ipv6" cidr, "prefix_list_id" character varying, "description" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "security_group_id" integer, "source_security_group" integer, CONSTRAINT "uq_security_group_rule_region" UNIQUE ("id", "region"), CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_id", "region"), CONSTRAINT "Check_security_or_ip_permissions" CHECK (("source_security_group" IS NULL AND ("from_port" IS NOT NULL AND "to_port" IS NOT NULL AND ("cidr_ipv4" IS NOT NULL OR "cidr_ipv6" IS NOT NULL))) OR ("source_security_group" IS NOT NULL AND (("from_port" IS NULL OR "from_port"=-1) AND ("to_port" IS NULL OR "to_port"=-1) AND ("cidr_ipv4" IS NULL OR "cidr_ipv4"='0.0.0.0/0') AND ("cidr_ipv6" IS NULL)))), CONSTRAINT "PK_f4c5f95331113ce4a2e1978a076" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group" ADD CONSTRAINT "FK_342e5da27cd7a3ab1712cdecece" FOREIGN KEY ("vpc_id", "region") REFERENCES "vpc"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group" ADD CONSTRAINT "FK_433340ca24146a956ba6eac946e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_54ae7b1b4edcb70ecce8499e76f" FOREIGN KEY ("security_group_id", "region") REFERENCES "security_group"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_6c6a7f58211fed8abb79e6c913f" FOREIGN KEY ("source_security_group") REFERENCES "security_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_2b4317dc68b3ba8fa5c9d4067c9" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_2b4317dc68b3ba8fa5c9d4067c9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_6c6a7f58211fed8abb79e6c913f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_54ae7b1b4edcb70ecce8499e76f"`,
    );
    await queryRunner.query(`ALTER TABLE "security_group" DROP CONSTRAINT "FK_433340ca24146a956ba6eac946e"`);
    await queryRunner.query(`ALTER TABLE "security_group" DROP CONSTRAINT "FK_342e5da27cd7a3ab1712cdecece"`);
    await queryRunner.query(`DROP TABLE "security_group_rule"`);
    await queryRunner.query(`DROP TABLE "security_group"`);
  }
}
