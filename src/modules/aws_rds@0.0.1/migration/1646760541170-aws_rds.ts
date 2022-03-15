import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1646760541170 implements MigrationInterface {
    name = 'awsRds1646760541170'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "availability_zone" character varying NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_aws_security_group" ("rds_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_30edb9d50aef608d12995047c4e" PRIMARY KEY ("rds_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf5fdc058ec5db521f32d4d6dd" ON "rds_vpc_security_groups_aws_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b0d4af7000a31b4657220db78" ON "rds_vpc_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_7b0d4af7000a31b4657220db78e" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_7b0d4af7000a31b4657220db78e"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b0d4af7000a31b4657220db78"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf5fdc058ec5db521f32d4d6dd"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "rds"`);
    }

}
