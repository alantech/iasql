import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsVpc1667590922115 implements MigrationInterface {
  name = 'awsVpc1667590922115';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "availability_zone" ("name" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_az_region" UNIQUE ("name", "region"), CONSTRAINT "PK_16d2ffe3b36dfa0f1de3c280c01" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "elastic_ip" ("id" SERIAL NOT NULL, "allocation_id" character varying, "public_ip" character varying, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_7d16382cad0b5eea714bd8d79b1" UNIQUE ("public_ip"), CONSTRAINT "elasticip_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_8f7ca624855a83f6ce36f8a88a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."endpoint_interface_service_enum" AS ENUM('s3', 's3-global.accesspoint', 'execute-api', 'rds', 'logs', 'codebuild', 'codedeploy', 'codepipeline', 'ec2', 'ecr', 'ecs', 'elasticloadbalancing', 'elasticache', 'lambda', 'memory-db')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."endpoint_interface_dns_name_record_type_enum" AS ENUM('dualstack', 'ipv4', 'ipv6', 'service-defined')`,
    );
    await queryRunner.query(
      `CREATE TABLE "endpoint_interface" ("id" SERIAL NOT NULL, "vpc_endpoint_id" character varying, "service" "public"."endpoint_interface_service_enum" NOT NULL, "policy_document" character varying, "state" character varying, "private_dns_enabled" boolean DEFAULT false, "dns_name_record_type" "public"."endpoint_interface_dns_name_record_type_enum" DEFAULT 'ipv4', "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "vpc_id" integer NOT NULL, CONSTRAINT "PK_a68d55bf3f06feb8ac5d8b8eee6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."vpc_state_enum" AS ENUM('available', 'pending')`);
    await queryRunner.query(
      `CREATE TABLE "vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying, "cidr_block" character varying NOT NULL, "state" "public"."vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, "enable_dns_hostnames" boolean NOT NULL DEFAULT false, "enable_dns_support" boolean NOT NULL DEFAULT false, "enable_network_address_usage_metrics" boolean NOT NULL DEFAULT false, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_vpc_id_region" UNIQUE ("vpc_id", "region"), CONSTRAINT "uq_vpc_region" UNIQUE ("id", "region"), CONSTRAINT "PK_293725cf47b341e1edc38bd2075" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."subnet_state_enum" AS ENUM('available', 'pending')`);
    await queryRunner.query(
      `CREATE TABLE "subnet" ("id" SERIAL NOT NULL, "state" "public"."subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying, "owner_id" character varying, "subnet_arn" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "availability_zone" character varying NOT NULL, "vpc_id" integer NOT NULL, CONSTRAINT "uq_subnet_id_region" UNIQUE ("subnet_id", "region"), CONSTRAINT "uq_subnet_region" UNIQUE ("id", "region"), CONSTRAINT "PK_27239a6d70e746b9ac33497a47f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."nat_gateway_connectivity_type_enum" AS ENUM('private', 'public')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."nat_gateway_state_enum" AS ENUM('available', 'deleted', 'deleting', 'failed', 'pending')`,
    );
    await queryRunner.query(
      `CREATE TABLE "nat_gateway" ("id" SERIAL NOT NULL, "nat_gateway_id" character varying, "connectivity_type" "public"."nat_gateway_connectivity_type_enum" NOT NULL, "state" "public"."nat_gateway_state_enum", "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "subnet_id" integer NOT NULL, "elastic_ip_id" integer, CONSTRAINT "REL_630cbc267698f4fbe265bc9aec" UNIQUE ("elastic_ip_id", "region"), CONSTRAINT "Check_elastic_ip_when_public" CHECK (("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null), CONSTRAINT "PK_42e867a771bbc0df315e3c38bfa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_service_enum" AS ENUM('dynamodb', 's3')`);
    await queryRunner.query(
      `CREATE TABLE "endpoint_gateway" ("id" SERIAL NOT NULL, "vpc_endpoint_id" character varying, "service" "public"."endpoint_gateway_service_enum" NOT NULL, "policy_document" character varying, "state" character varying, "route_table_ids" text array, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "vpc_id" integer NOT NULL, CONSTRAINT "PK_b81d6fec498a6dca8304f9de403" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "endpoint_interface_subnets" ("endpoint_interface_id" integer NOT NULL, "subnet_id" integer NOT NULL, CONSTRAINT "PK_edb3c3e9dc6eb5838e9b4203453" PRIMARY KEY ("endpoint_interface_id", "subnet_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a1d6b751b00a4f108993dd338" ON "endpoint_interface_subnets" ("endpoint_interface_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4cc01b4cb8c79840e521644f41" ON "endpoint_interface_subnets" ("subnet_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_9557e4873661a90723a39e5b9c2" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "elastic_ip" ADD CONSTRAINT "FK_f75b4d19cd93ba87e5ab6219df2" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface" ADD CONSTRAINT "FK_f94801d992a1d1e5237864341a7" FOREIGN KEY ("vpc_id", "region") REFERENCES "vpc"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface" ADD CONSTRAINT "FK_559c34e1a6c47af95fd9eb47924" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vpc" ADD CONSTRAINT "FK_4e3193d811417bcd61e4f305e74" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subnet" ADD CONSTRAINT "FK_89d16ba5682889f8fae7927052c" FOREIGN KEY ("availability_zone", "region") REFERENCES "availability_zone"("name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subnet" ADD CONSTRAINT "FK_0e2c2bf1604ba2ffd4103157d24" FOREIGN KEY ("vpc_id", "region") REFERENCES "vpc"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subnet" ADD CONSTRAINT "FK_01b828964edce6b867e4e554b97" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_a8a06631830bd53add76d00579b" FOREIGN KEY ("subnet_id", "region") REFERENCES "subnet"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_630cbc267698f4fbe265bc9aecf" FOREIGN KEY ("elastic_ip_id", "region") REFERENCES "elastic_ip"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_0b6b32474c287236151d32ee15e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" ADD CONSTRAINT "FK_f4b22969137e68a91da4e9510b7" FOREIGN KEY ("vpc_id", "region") REFERENCES "vpc"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" ADD CONSTRAINT "FK_54d6c333020521f251592867da4" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface_subnets" ADD CONSTRAINT "FK_0a1d6b751b00a4f108993dd3385" FOREIGN KEY ("endpoint_interface_id") REFERENCES "endpoint_interface"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface_subnets" ADD CONSTRAINT "FK_4cc01b4cb8c79840e521644f416" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface_subnets" DROP CONSTRAINT "FK_4cc01b4cb8c79840e521644f416"`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface_subnets" DROP CONSTRAINT "FK_0a1d6b751b00a4f108993dd3385"`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" DROP CONSTRAINT "FK_54d6c333020521f251592867da4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" DROP CONSTRAINT "FK_f4b22969137e68a91da4e9510b7"`,
    );
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_0b6b32474c287236151d32ee15e"`);
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_630cbc267698f4fbe265bc9aecf"`);
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_a8a06631830bd53add76d00579b"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_01b828964edce6b867e4e554b97"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_0e2c2bf1604ba2ffd4103157d24"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_89d16ba5682889f8fae7927052c"`);
    await queryRunner.query(`ALTER TABLE "vpc" DROP CONSTRAINT "FK_4e3193d811417bcd61e4f305e74"`);
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface" DROP CONSTRAINT "FK_559c34e1a6c47af95fd9eb47924"`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_interface" DROP CONSTRAINT "FK_f94801d992a1d1e5237864341a7"`,
    );
    await queryRunner.query(`ALTER TABLE "elastic_ip" DROP CONSTRAINT "FK_f75b4d19cd93ba87e5ab6219df2"`);
    await queryRunner.query(
      `ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_9557e4873661a90723a39e5b9c2"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_4cc01b4cb8c79840e521644f41"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0a1d6b751b00a4f108993dd338"`);
    await queryRunner.query(`DROP TABLE "endpoint_interface_subnets"`);
    await queryRunner.query(`DROP TABLE "endpoint_gateway"`);
    await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_service_enum"`);
    await queryRunner.query(`DROP TABLE "nat_gateway"`);
    await queryRunner.query(`DROP TYPE "public"."nat_gateway_state_enum"`);
    await queryRunner.query(`DROP TYPE "public"."nat_gateway_connectivity_type_enum"`);
    await queryRunner.query(`DROP TABLE "subnet"`);
    await queryRunner.query(`DROP TYPE "public"."subnet_state_enum"`);
    await queryRunner.query(`DROP TABLE "vpc"`);
    await queryRunner.query(`DROP TYPE "public"."vpc_state_enum"`);
    await queryRunner.query(`DROP TABLE "endpoint_interface"`);
    await queryRunner.query(`DROP TYPE "public"."endpoint_interface_dns_name_record_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."endpoint_interface_service_enum"`);
    await queryRunner.query(`DROP TABLE "elastic_ip"`);
    await queryRunner.query(`DROP TABLE "availability_zone"`);
  }
}