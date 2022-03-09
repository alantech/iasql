import {MigrationInterface, QueryRunner} from "typeorm";

export class awsSecurityGroup1646785734100 implements MigrationInterface {
    name = 'awsSecurityGroup1646785734100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_security_group" ("id" SERIAL NOT NULL, "description" character varying, "group_name" character varying, "owner_id" character varying, "group_id" character varying, "vpc_id" character varying, CONSTRAINT "PK_c95f0d51761dbddd9c3950d75be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_security_group_rule" ("id" SERIAL NOT NULL, "security_group_rule_id" character varying, "is_egress" boolean NOT NULL, "ip_protocol" character varying NOT NULL, "from_port" integer, "to_port" integer, "cidr_ipv4" cidr, "cidr_ipv6" cidr, "prefix_list_id" character varying, "description" character varying, "security_group_id" integer, CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_id"), CONSTRAINT "PK_e9776ba4916babd78e029b421e4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" ADD CONSTRAINT "FK_6d3482619216803d2f14ecf609d" FOREIGN KEY ("security_group_id") REFERENCES "aws_security_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" DROP CONSTRAINT "FK_6d3482619216803d2f14ecf609d"`);
        await queryRunner.query(`DROP TABLE "aws_security_group_rule"`);
        await queryRunner.query(`DROP TABLE "aws_security_group"`);
    }

}
