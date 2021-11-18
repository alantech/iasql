import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAccount1637177234221 implements MigrationInterface {
    name = 'awsAccount1637177234221'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "region" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "endpoint" character varying NOT NULL, "opt_in_status" character varying NOT NULL, CONSTRAINT "PK_5f48ffc3af96bc486f5f3f3a6da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "availability_zone_state_enum" AS ENUM('available', 'impaired', 'information', 'unavailable')`);
        await queryRunner.query(`CREATE TYPE "availability_zone_opt_in_status_enum" AS ENUM('not-opted-in', 'opt-in-not-required', 'opted-in')`);
        await queryRunner.query(`CREATE TABLE "availability_zone" ("id" SERIAL NOT NULL, "state" "availability_zone_state_enum" NOT NULL DEFAULT 'available', "opt_in_status" "availability_zone_opt_in_status_enum" NOT NULL DEFAULT 'opt-in-not-required', "zone_name" character varying NOT NULL, "zone_id" character varying NOT NULL, "group_name" character varying NOT NULL, "network_border_group" character varying NOT NULL, "region_id" integer, "parent_zone_id" integer, CONSTRAINT "PK_23adf1bb98959e74d950cf58714" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "availability_zone_message" ("id" SERIAL NOT NULL, "message" character varying NOT NULL, "availability_zone_id" integer, CONSTRAINT "PK_60b38e6df050cc2d22321751c35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region_id" integer, CONSTRAINT "PK_9ad897024d8c36c541d7fe84084" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_vpc_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying NOT NULL, "cidr_block" character varying NOT NULL, "state" "aws_vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8b6c8f56ab27571e63b780c06fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_subnet_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_subnet" ("id" SERIAL NOT NULL, "state" "aws_subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying NOT NULL, "owner_id" character varying, "subnet_arn" character varying, "availability_zone_id" integer, "vpc_id" integer NOT NULL, CONSTRAINT "PK_5c7324c6b9049d07fd5799ec1fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_160725b74916b629f0c13aa0f45" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_cafbf58d3030aa29f19048a9f42" FOREIGN KEY ("parent_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_zone_message" ADD CONSTRAINT "FK_764e5bfc94327238c052b608452" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_account" ADD CONSTRAINT "FK_77c78b1b76002e028cde49bc53a" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_subnet" ADD CONSTRAINT "FK_f032627b6afa6f0bdf82871d271" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_subnet" ADD CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2" FOREIGN KEY ("vpc_id") REFERENCES "aws_vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_subnet" DROP CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2"`);
        await queryRunner.query(`ALTER TABLE "aws_subnet" DROP CONSTRAINT "FK_f032627b6afa6f0bdf82871d271"`);
        await queryRunner.query(`ALTER TABLE "aws_account" DROP CONSTRAINT "FK_77c78b1b76002e028cde49bc53a"`);
        await queryRunner.query(`ALTER TABLE "availability_zone_message" DROP CONSTRAINT "FK_764e5bfc94327238c052b608452"`);
        await queryRunner.query(`ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_cafbf58d3030aa29f19048a9f42"`);
        await queryRunner.query(`ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_160725b74916b629f0c13aa0f45"`);
        await queryRunner.query(`DROP TABLE "aws_subnet"`);
        await queryRunner.query(`DROP TYPE "aws_subnet_state_enum"`);
        await queryRunner.query(`DROP TABLE "aws_vpc"`);
        await queryRunner.query(`DROP TYPE "aws_vpc_state_enum"`);
        await queryRunner.query(`DROP TABLE "aws_account"`);
        await queryRunner.query(`DROP TABLE "availability_zone_message"`);
        await queryRunner.query(`DROP TABLE "availability_zone"`);
        await queryRunner.query(`DROP TYPE "availability_zone_opt_in_status_enum"`);
        await queryRunner.query(`DROP TYPE "availability_zone_state_enum"`);
        await queryRunner.query(`DROP TABLE "region"`);
    }

}
