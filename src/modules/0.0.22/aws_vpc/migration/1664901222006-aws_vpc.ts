import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsVpc1664901222006 implements MigrationInterface {
  name = 'awsVpc1664901222006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "availability_zone" ("name" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_az_region" UNIQUE ("name", "region"), CONSTRAINT "PK_16d2ffe3b36dfa0f1de3c280c01" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "elastic_ip" ("id" SERIAL NOT NULL, "allocation_id" character varying, "public_ip" character varying, "tags" json, CONSTRAINT "UQ_7d16382cad0b5eea714bd8d79b1" UNIQUE ("public_ip"), CONSTRAINT "PK_8f7ca624855a83f6ce36f8a88a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."vpc_state_enum" AS ENUM('available', 'pending')`);
    await queryRunner.query(
      `CREATE TABLE "vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying, "cidr_block" character varying NOT NULL, "state" "public"."vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_vpc_id_region" UNIQUE ("vpc_id", "region"), CONSTRAINT "uq_vpc_region" UNIQUE ("id", "region"), CONSTRAINT "PK_293725cf47b341e1edc38bd2075" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b978cbc48bf5ef1c8eb8bfbdb3" ON "vpc" ("vpc_id") WHERE vpc_id IS NOT NULL`,
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
      `CREATE TABLE "nat_gateway" ("id" SERIAL NOT NULL, "nat_gateway_id" character varying, "connectivity_type" "public"."nat_gateway_connectivity_type_enum" NOT NULL, "state" "public"."nat_gateway_state_enum", "tags" json, "subnet_id" integer NOT NULL, "elastic_ip_id" integer, CONSTRAINT "REL_398d5c82233501745759cb9dc3" UNIQUE ("elastic_ip_id"), CONSTRAINT "Check_elastic_ip_when_public" CHECK (("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null), CONSTRAINT "PK_42e867a771bbc0df315e3c38bfa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_service_enum" AS ENUM('dynamodb', 's3')`);
    await queryRunner.query(
      `CREATE TABLE "endpoint_gateway" ("id" SERIAL NOT NULL, "vpc_endpoint_id" character varying, "service" "public"."endpoint_gateway_service_enum" NOT NULL, "policy_document" character varying, "state" character varying, "route_table_ids" text array, "tags" json, "vpc_id" integer NOT NULL, CONSTRAINT "PK_b81d6fec498a6dca8304f9de403" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_9557e4873661a90723a39e5b9c2" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_902c1e8953c40c17c23265e14dc" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_398d5c82233501745759cb9dc3d" FOREIGN KEY ("elastic_ip_id") REFERENCES "elastic_ip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" ADD CONSTRAINT "FK_cea670f322f7a21bd20c35dd008" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" DROP CONSTRAINT "FK_cea670f322f7a21bd20c35dd008"`,
    );
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_398d5c82233501745759cb9dc3d"`);
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_902c1e8953c40c17c23265e14dc"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_01b828964edce6b867e4e554b97"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_0e2c2bf1604ba2ffd4103157d24"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_89d16ba5682889f8fae7927052c"`);
    await queryRunner.query(`ALTER TABLE "vpc" DROP CONSTRAINT "FK_4e3193d811417bcd61e4f305e74"`);
    await queryRunner.query(
      `ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_9557e4873661a90723a39e5b9c2"`,
    );
    await queryRunner.query(`DROP TABLE "endpoint_gateway"`);
    await queryRunner.query(`DROP TYPE "public"."endpoint_gateway_service_enum"`);
    await queryRunner.query(`DROP TABLE "nat_gateway"`);
    await queryRunner.query(`DROP TYPE "public"."nat_gateway_state_enum"`);
    await queryRunner.query(`DROP TYPE "public"."nat_gateway_connectivity_type_enum"`);
    await queryRunner.query(`DROP TABLE "subnet"`);
    await queryRunner.query(`DROP TYPE "public"."subnet_state_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b978cbc48bf5ef1c8eb8bfbdb3"`);
    await queryRunner.query(`DROP TABLE "vpc"`);
    await queryRunner.query(`DROP TYPE "public"."vpc_state_enum"`);
    await queryRunner.query(`DROP TABLE "elastic_ip"`);
    await queryRunner.query(`DROP TABLE "availability_zone"`);
  }
}
