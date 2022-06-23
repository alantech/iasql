import {MigrationInterface, QueryRunner} from "typeorm";

export class awsVpc1655985996826 implements MigrationInterface {
    name = 'awsVpc1655985996826'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "elastic_ip" ("id" SERIAL NOT NULL, "allocation_id" character varying, "public_ip" character varying, "tags" json, CONSTRAINT "UQ_7d16382cad0b5eea714bd8d79b1" UNIQUE ("public_ip"), CONSTRAINT "PK_8f7ca624855a83f6ce36f8a88a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_service_enum" AS ENUM('dynamodb', 's3')`);
        await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_ip_address_type_enum" AS ENUM('dualstack', 'ipv4', 'ipv6', 'service-defined')`);
        await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_dns_record_ip_type_enum" AS ENUM('dualstack', 'ipv4', 'ipv6', 'service-defined')`);
        await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_state_enum" AS ENUM('Available', 'Deleted', 'Deleting', 'Expired', 'Failed', 'Pending', 'PendingAcceptance', 'Rejected')`);
        await queryRunner.query(`CREATE TABLE "endpoint_gateway" ("id" SERIAL NOT NULL, "vpc_endpoint_id" character varying, "service" "public"."endpoint_gateway_service_enum" NOT NULL, "policy_document" character varying, "ip_address_type" "public"."endpoint_gateway_ip_address_type_enum", "dns_record_ip_type" "public"."endpoint_gateway_dns_record_ip_type_enum", "state" "public"."endpoint_gateway_state_enum", "tags" json, "vpc_id" integer NOT NULL, CONSTRAINT "PK_b81d6fec498a6dca8304f9de403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."vpc_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying, "cidr_block" character varying NOT NULL, "state" "public"."vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_293725cf47b341e1edc38bd2075" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b978cbc48bf5ef1c8eb8bfbdb3" ON "vpc" ("vpc_id") WHERE vpc_id IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."subnet_availability_zone_enum" AS ENUM('ap-northeast-1-wl1-kix-wlz-1', 'ap-northeast-1-wl1-nrt-wlz-1', 'ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d', 'ap-northeast-2-wl1-cjj-wlz-1', 'ap-northeast-2a', 'ap-northeast-2b', 'ap-northeast-2c', 'ap-northeast-2d', 'ap-northeast-3a', 'ap-northeast-3b', 'ap-northeast-3c', 'ap-south-1a', 'ap-south-1b', 'ap-south-1c', 'ap-southeast-1a', 'ap-southeast-1b', 'ap-southeast-1c', 'ap-southeast-2a', 'ap-southeast-2b', 'ap-southeast-2c', 'ca-central-1a', 'ca-central-1b', 'ca-central-1d', 'eu-central-1-wl1-ber-wlz-1', 'eu-central-1-wl1-dtm-wlz-1', 'eu-central-1-wl1-muc-wlz-1', 'eu-central-1a', 'eu-central-1b', 'eu-central-1c', 'eu-north-1a', 'eu-north-1b', 'eu-north-1c', 'eu-west-1a', 'eu-west-1b', 'eu-west-1c', 'eu-west-2-wl1-lon-wlz-1', 'eu-west-2a', 'eu-west-2b', 'eu-west-2c', 'eu-west-3a', 'eu-west-3b', 'eu-west-3c', 'sa-east-1a', 'sa-east-1b', 'sa-east-1c', 'us-east-1-atl-1a', 'us-east-1-bos-1a', 'us-east-1-chi-1a', 'us-east-1-dfw-1a', 'us-east-1-iah-1a', 'us-east-1-mci-1a', 'us-east-1-mia-1a', 'us-east-1-msp-1a', 'us-east-1-nyc-1a', 'us-east-1-phl-1a', 'us-east-1-wl1-atl-wlz-1', 'us-east-1-wl1-bos-wlz-1', 'us-east-1-wl1-chi-wlz-1', 'us-east-1-wl1-clt-wlz-1', 'us-east-1-wl1-dfw-wlz-1', 'us-east-1-wl1-dtw-wlz-1', 'us-east-1-wl1-iah-wlz-1', 'us-east-1-wl1-mia-wlz-1', 'us-east-1-wl1-msp-wlz-1', 'us-east-1-wl1-nyc-wlz-1', 'us-east-1-wl1-was-wlz-1', 'us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f', 'us-east-2a', 'us-east-2b', 'us-east-2c', 'us-west-1a', 'us-west-1b', 'us-west-1c', 'us-west-2-den-1a', 'us-west-2-las-1a', 'us-west-2-lax-1a', 'us-west-2-lax-1b', 'us-west-2-pdx-1a', 'us-west-2-phx-1a', 'us-west-2-sea-1a', 'us-west-2-wl1-den-wlz-1', 'us-west-2-wl1-las-wlz-1', 'us-west-2-wl1-lax-wlz-1', 'us-west-2-wl1-phx-wlz-1', 'us-west-2-wl1-sea-wlz-1', 'us-west-2-wl1-sfo-wlz-1', 'us-west-2a', 'us-west-2b', 'us-west-2c', 'us-west-2d')`);
        await queryRunner.query(`CREATE TYPE "public"."subnet_state_enum" AS ENUM('available', 'pending')`);
        await queryRunner.query(`CREATE TABLE "subnet" ("id" SERIAL NOT NULL, "availability_zone" "public"."subnet_availability_zone_enum" NOT NULL, "state" "public"."subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying, "owner_id" character varying, "subnet_arn" character varying, "vpc_id" integer NOT NULL, CONSTRAINT "PK_27239a6d70e746b9ac33497a47f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."nat_gateway_connectivity_type_enum" AS ENUM('private', 'public')`);
        await queryRunner.query(`CREATE TYPE "public"."nat_gateway_state_enum" AS ENUM('available', 'deleted', 'deleting', 'failed', 'pending')`);
        await queryRunner.query(`CREATE TABLE "nat_gateway" ("id" SERIAL NOT NULL, "nat_gateway_id" character varying, "connectivity_type" "public"."nat_gateway_connectivity_type_enum" NOT NULL, "state" "public"."nat_gateway_state_enum", "tags" json, "subnet_id" integer NOT NULL, "elastic_ip_id" integer, CONSTRAINT "REL_398d5c82233501745759cb9dc3" UNIQUE ("elastic_ip_id"), CONSTRAINT "Check_elastic_ip_when_public" CHECK (("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null), CONSTRAINT "PK_42e867a771bbc0df315e3c38bfa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "endpoint_gateway" ADD CONSTRAINT "FK_cea670f322f7a21bd20c35dd008" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subnet" ADD CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_902c1e8953c40c17c23265e14dc" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_398d5c82233501745759cb9dc3d" FOREIGN KEY ("elastic_ip_id") REFERENCES "elastic_ip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_398d5c82233501745759cb9dc3d"`);
        await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_902c1e8953c40c17c23265e14dc"`);
        await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf"`);
        await queryRunner.query(`ALTER TABLE "endpoint_gateway" DROP CONSTRAINT "FK_cea670f322f7a21bd20c35dd008"`);
        await queryRunner.query(`DROP TABLE "nat_gateway"`);
        await queryRunner.query(`DROP TYPE "public"."nat_gateway_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."nat_gateway_connectivity_type_enum"`);
        await queryRunner.query(`DROP TABLE "subnet"`);
        await queryRunner.query(`DROP TYPE "public"."subnet_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."subnet_availability_zone_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b978cbc48bf5ef1c8eb8bfbdb3"`);
        await queryRunner.query(`DROP TABLE "vpc"`);
        await queryRunner.query(`DROP TYPE "public"."vpc_state_enum"`);
        await queryRunner.query(`DROP TABLE "endpoint_gateway"`);
        await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_dns_record_ip_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_service_enum"`);
        await queryRunner.query(`DROP TABLE "elastic_ip"`);
    }

}
