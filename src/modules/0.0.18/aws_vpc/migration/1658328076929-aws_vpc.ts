import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsVpc1658328076929 implements MigrationInterface {
  name = 'awsVpc1658328076929';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "availability_zone" ("name" character varying NOT NULL, CONSTRAINT "PK_16d2ffe3b36dfa0f1de3c280c01" PRIMARY KEY ("name"))`
    );
    await queryRunner.query(
      `CREATE TABLE "elastic_ip" ("id" SERIAL NOT NULL, "allocation_id" character varying, "public_ip" character varying, "tags" json, CONSTRAINT "UQ_7d16382cad0b5eea714bd8d79b1" UNIQUE ("public_ip"), CONSTRAINT "PK_8f7ca624855a83f6ce36f8a88a1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE TYPE "public"."vpc_state_enum" AS ENUM('available', 'pending')`);
    await queryRunner.query(
      `CREATE TABLE "vpc" ("id" SERIAL NOT NULL, "vpc_id" character varying, "cidr_block" character varying NOT NULL, "state" "public"."vpc_state_enum", "is_default" boolean NOT NULL DEFAULT false, "tags" json, CONSTRAINT "PK_293725cf47b341e1edc38bd2075" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b978cbc48bf5ef1c8eb8bfbdb3" ON "vpc" ("vpc_id") WHERE vpc_id IS NOT NULL`
    );
    await queryRunner.query(`CREATE TYPE "public"."subnet_state_enum" AS ENUM('available', 'pending')`);
    await queryRunner.query(
      `CREATE TABLE "subnet" ("id" SERIAL NOT NULL, "state" "public"."subnet_state_enum", "available_ip_address_count" integer, "cidr_block" character varying, "subnet_id" character varying, "owner_id" character varying, "subnet_arn" character varying, "availability_zone" character varying NOT NULL, "vpc_id" integer NOT NULL, CONSTRAINT "PK_27239a6d70e746b9ac33497a47f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE TYPE "public"."nat_gateway_connectivity_type_enum" AS ENUM('private', 'public')`);
    await queryRunner.query(
      `CREATE TYPE "public"."nat_gateway_state_enum" AS ENUM('available', 'deleted', 'deleting', 'failed', 'pending')`
    );
    await queryRunner.query(
      `CREATE TABLE "nat_gateway" ("id" SERIAL NOT NULL, "nat_gateway_id" character varying, "connectivity_type" "public"."nat_gateway_connectivity_type_enum" NOT NULL, "state" "public"."nat_gateway_state_enum", "tags" json, "subnet_id" integer NOT NULL, "elastic_ip_id" integer, CONSTRAINT "REL_398d5c82233501745759cb9dc3" UNIQUE ("elastic_ip_id"), CONSTRAINT "Check_elastic_ip_when_public" CHECK (("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null), CONSTRAINT "PK_42e867a771bbc0df315e3c38bfa" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE TYPE "public"."endpoint_gateway_service_enum" AS ENUM('dynamodb', 's3')`);
    await queryRunner.query(
      `CREATE TABLE "endpoint_gateway" ("id" SERIAL NOT NULL, "vpc_endpoint_id" character varying, "service" "public"."endpoint_gateway_service_enum" NOT NULL, "policy_document" character varying, "state" character varying, "route_table_ids" text array, "tags" json, "vpc_id" integer NOT NULL, CONSTRAINT "PK_b81d6fec498a6dca8304f9de403" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "subnet" ADD CONSTRAINT "FK_93592d2af8429f2614b4ea3686d" FOREIGN KEY ("availability_zone") REFERENCES "availability_zone"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "subnet" ADD CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_902c1e8953c40c17c23265e14dc" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "nat_gateway" ADD CONSTRAINT "FK_398d5c82233501745759cb9dc3d" FOREIGN KEY ("elastic_ip_id") REFERENCES "elastic_ip"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "endpoint_gateway" ADD CONSTRAINT "FK_cea670f322f7a21bd20c35dd008" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "endpoint_gateway" DROP CONSTRAINT "FK_cea670f322f7a21bd20c35dd008"`);
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_398d5c82233501745759cb9dc3d"`);
    await queryRunner.query(`ALTER TABLE "nat_gateway" DROP CONSTRAINT "FK_902c1e8953c40c17c23265e14dc"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_6b5bf9e47cab22f2857019b8eaf"`);
    await queryRunner.query(`ALTER TABLE "subnet" DROP CONSTRAINT "FK_93592d2af8429f2614b4ea3686d"`);
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
