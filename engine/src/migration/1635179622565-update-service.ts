import {MigrationInterface, QueryRunner} from "typeorm";

export class updateService1635179622565 implements MigrationInterface {
    name = 'updateService1635179622565'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aws_vpc_conf_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf" ("id" SERIAL NOT NULL, "assign_public_ip" "public"."aws_vpc_conf_assign_public_ip_enum", CONSTRAINT "PK_23873df17bd3e0744254b4ccd9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf_subnets_subnet" ("aws_vpc_conf_id" integer NOT NULL, "subnet_id" integer NOT NULL, CONSTRAINT "PK_b15e3891ad0ced9274d83e40c5f" PRIMARY KEY ("aws_vpc_conf_id", "subnet_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_77f9453f1e7786fe4a9365b85f" ON "aws_vpc_conf_subnets_subnet" ("aws_vpc_conf_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b2570a6585456ef66d2c4758a5" ON "aws_vpc_conf_subnets_subnet" ("subnet_id") `);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf_security_groups_security_group" ("aws_vpc_conf_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_6d12e18bc4de16111fb4816babc" PRIMARY KEY ("aws_vpc_conf_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_32fa55c3d94cf6c8cb448d004c" ON "aws_vpc_conf_security_groups_security_group" ("aws_vpc_conf_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b13d0f7f00515c023900259abe" ON "aws_vpc_conf_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "service" ADD "aws_vpc_conf_id" integer`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_subnet" ADD CONSTRAINT "FK_77f9453f1e7786fe4a9365b85f0" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_subnet" ADD CONSTRAINT "FK_b2570a6585456ef66d2c4758a5e" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_security_group" ADD CONSTRAINT "FK_32fa55c3d94cf6c8cb448d004cd" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_security_group" ADD CONSTRAINT "FK_b13d0f7f00515c023900259abec" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_security_group" DROP CONSTRAINT "FK_b13d0f7f00515c023900259abec"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_security_group" DROP CONSTRAINT "FK_32fa55c3d94cf6c8cb448d004cd"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_subnet" DROP CONSTRAINT "FK_b2570a6585456ef66d2c4758a5e"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_subnet" DROP CONSTRAINT "FK_77f9453f1e7786fe4a9365b85f0"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" DROP COLUMN "aws_vpc_conf_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b13d0f7f00515c023900259abe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32fa55c3d94cf6c8cb448d004c"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf_security_groups_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2570a6585456ef66d2c4758a5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77f9453f1e7786fe4a9365b85f"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf_subnets_subnet"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf"`);
        await queryRunner.query(`DROP TYPE "public"."aws_vpc_conf_assign_public_ip_enum"`);
    }

}
