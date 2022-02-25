import {MigrationInterface, QueryRunner} from "typeorm";

export class awsVpc1645805825036 implements MigrationInterface {
    name = 'awsVpc1645805825036'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aws_vpc_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying, "cidr_block" character varying NOT NULL, "state" "public"."aws_vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8b6c8f56ab27571e63b780c06fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_subnet_availability_zone_enum" AS ENUM('ap-northeast-1-wl1-kix-wlz-1', 'ap-northeast-1-wl1-nrt-wlz-1', 'ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d', 'ap-northeast-2-wl1-cjj-wlz-1', 'ap-northeast-2a', 'ap-northeast-2b', 'ap-northeast-2c', 'ap-northeast-2d', 'ap-northeast-3a', 'ap-northeast-3b', 'ap-northeast-3c', 'ap-south-1a', 'ap-south-1b', 'ap-south-1c', 'ap-southeast-1a', 'ap-southeast-1b', 'ap-southeast-1c', 'ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c', 'ca-central-1a', 'ca-central-1b', 'ca-central-1d', 'eu-central-1-wl1-ber-wlz-1', 'eu-central-1-wl1-dtm-wlz-1', 'eu-central-1-wl1-muc-wlz-1', 'eu-central-1a', 'eu-central-1b', 'eu-central-1c', 'eu-north-1a', 'eu-north-1b', 'eu-north-1c', 'eu-west-1a', 'eu-west-1b', 'eu-west-1c', 'eu-west-2-wl1-lon-wlz-1', 'eu-west-2a', 'eu-west-2b', 'eu-west-2c', 'eu-west-3a', 'eu-west-3b', 'eu-west-3c', 'sa-east-1a', 'sa-east-1b', 'sa-east-1c', 'us-east-1-atl-1a', 'us-east-1-bos-1a', 'us-east-1-chi-1a', 'us-east-1-dfw-1a', 'us-east-1-iah-1a', 'us-east-1-mci-1a', 'us-east-1-mia-1a', 'us-east-1-msp-1a', 'us-east-1-nyc-1a', 'us-east-1-phl-1a', 'us-east-1-wl1-atl-wlz-1', 'us-east-1-wl1-bos-wlz-1', 'us-east-1-wl1-chi-wlz-1', 'us-east-1-wl1-clt-wlz-1', 'us-east-1-wl1-dfw-wlz-1', 'us-east-1-wl1-dtw-wlz-1', 'us-east-1-wl1-iah-wlz-1', 'us-east-1-wl1-mia-wlz-1', 'us-east-1-wl1-msp-wlz-1', 'us-east-1-wl1-nyc-wlz-1', 'us-east-1-wl1-was-wlz-1', 'us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f', 'us-east-2a', 'us-east-2b', 'us-east-2c', 'us-west-1a', 'us-west-1c', 'us-west-2-den-1a', 'us-west-2-las-1a', 'us-west-2-lax-1a', 'us-west-2-lax-1b', 'us-west-2-pdx-1a', 'us-west-2-phx-1a', 'us-west-2-sea-1a', 'us-west-2-wl1-den-wlz-1', 'us-west-2-wl1-las-wlz-1', 'us-west-2-wl1-lax-wlz-1', 'us-west-2-wl1-phx-wlz-1', 'us-west-2-wl1-sea-wlz-1', 'us-west-2-wl1-sfo-wlz-1', 'us-west-2a', 'us-west-2b', 'us-west-2c', 'us-west-2d')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_subnet_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "aws_subnet" ("id" SERIAL NOT NULL, "availability_zone" "public"."aws_subnet_availability_zone_enum" NOT NULL, "state" "public"."aws_subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying, "owner_id" character varying, "subnet_arn" character varying, "vpc_id" integer NOT NULL, CONSTRAINT "PK_5c7324c6b9049d07fd5799ec1fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_subnet" ADD CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2" FOREIGN KEY ("vpc_id") REFERENCES "aws_vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_subnet" DROP CONSTRAINT "FK_0f8b7750905ef3209a892aec1e2"`);
        await queryRunner.query(`DROP TABLE "aws_subnet"`);
        await queryRunner.query(`DROP TYPE "public"."aws_subnet_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_subnet_availability_zone_enum"`);
        await queryRunner.query(`DROP TABLE "aws_vpc"`);
        await queryRunner.query(`DROP TYPE "public"."aws_vpc_state_enum"`);
    }

}
