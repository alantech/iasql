import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAccount1637164047096 implements MigrationInterface {
    name = 'awsAccount1637164047096'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "PK_9ad897024d8c36c541d7fe84084" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_vpc_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying NOT NULL, "cidr_block" character varying NOT NULL, "state" "aws_vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8b6c8f56ab27571e63b780c06fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_subnet_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_subnet" ("id" SERIAL NOT NULL, "state" "aws_subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying NOT NULL, "owner_id" character varying, "subnet_arn" character varying, "vpc_id" integer NOT NULL, CONSTRAINT "PK_5c7324c6b9049d07fd5799ec1fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_subnet" ADD CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2" FOREIGN KEY ("vpc_id") REFERENCES "aws_vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_subnet" DROP CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2"`);
        await queryRunner.query(`DROP TABLE "aws_subnet"`);
        await queryRunner.query(`DROP TYPE "aws_subnet_state_enum"`);
        await queryRunner.query(`DROP TABLE "aws_vpc"`);
        await queryRunner.query(`DROP TYPE "aws_vpc_state_enum"`);
        await queryRunner.query(`DROP TABLE "aws_account"`);
    }

}
