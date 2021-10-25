import {MigrationInterface, QueryRunner} from "typeorm";

export class vpcSubnet1635169753499 implements MigrationInterface {
    name = 'vpcSubnet1635169753499'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."vpc_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "vpc" ("id" SERIAL NOT NULL, "cidr_block" character varying NOT NULL, "state" "public"."vpc_state_enum", "vpc_id" character varying, "is_default" boolean, CONSTRAINT "PK_293725cf47b341e1edc38bd2075" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."subnet_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "subnet" ("id" SERIAL NOT NULL, "state" "public"."subnet_state_enum", "available_ip_address_count" integer, "cidr_block" boolean, "subnet_id" character varying, "owner_id" character varying, "subnet_arn" character varying, "availability_zone_id" integer, "vpc_id" integer, CONSTRAINT "PK_27239a6d70e746b9ac33497a47f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "subnet" ADD CONSTRAINT "FK_f6f6bea1bf62549b3ad22069327" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subnet" ADD CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf"`);
        await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_f6f6bea1bf62549b3ad22069327"`);
        await queryRunner.query(`DROP TABLE "subnet"`);
        await queryRunner.query(`DROP TYPE "public"."subnet_state_enum"`);
        await queryRunner.query(`DROP TABLE "vpc"`);
        await queryRunner.query(`DROP TYPE "public"."vpc_state_enum"`);
    }

}
