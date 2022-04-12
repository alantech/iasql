import {MigrationInterface, QueryRunner} from "typeorm";

export class awsSecurityGroup1649728913899 implements MigrationInterface {
    name = 'awsSecurityGroup1649728913899'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "security_group" ("group_name" character varying NOT NULL, "description" character varying, "owner_id" character varying, "group_id" character varying, "vpc_id" character varying, CONSTRAINT "PK_ae05ede7fa10211c645cdac7b14" PRIMARY KEY ("group_name"))`);
        await queryRunner.query(`CREATE TABLE "security_group_rule" ("id" SERIAL NOT NULL, "security_group_rule_id" character varying, "is_egress" boolean NOT NULL, "ip_protocol" character varying NOT NULL, "from_port" integer, "to_port" integer, "cidr_ipv4" cidr, "cidr_ipv6" cidr, "prefix_list_id" character varying, "description" character varying, "security_group_name" character varying, CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_name"), CONSTRAINT "PK_f4c5f95331113ce4a2e1978a076" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "security_group_rule" ADD CONSTRAINT "FK_abd79120249dc676b55c7c21bd8" FOREIGN KEY ("security_group_name") REFERENCES "security_group"("group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "security_group_rule" DROP CONSTRAINT "FK_abd79120249dc676b55c7c21bd8"`);
        await queryRunner.query(`DROP TABLE "security_group_rule"`);
        await queryRunner.query(`DROP TABLE "security_group"`);
    }

}
