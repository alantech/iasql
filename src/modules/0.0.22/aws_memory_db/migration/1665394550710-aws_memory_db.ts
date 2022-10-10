import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsMemoryDb1665394550710 implements MigrationInterface {
  name = 'awsMemoryDb1665394550710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subnet_group" ("id" SERIAL NOT NULL, "subnet_group_name" character varying NOT NULL, "description" character varying, "arn" character varying, "subnets" character varying array, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_subnet_group_name_region" UNIQUE ("subnet_group_name", "region"), CONSTRAINT "uq_subnet_group_id_region" UNIQUE ("id", "region"), CONSTRAINT "check_subnet_group_subnets_same_vpc" CHECK (check_subnet_group_subnets_same_vpc(subnets)), CONSTRAINT "check_subnet_group_subnets" CHECK (check_subnet_group_subnets(subnets)), CONSTRAINT "PK_a54731069caf05d2029dc7cd4c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memory_db_cluster_node_type_enum" AS ENUM('db.t4g.small', 'db.t4g.medium', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge', 'db.r6g.4xlarge', 'db.r6g.8xlarge', 'db.r6g.12xlarge', 'db.r6g.16xlarg')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "description" character varying, "address" character varying, "port" integer NOT NULL DEFAULT '6379', "node_type" "public"."memory_db_cluster_node_type_enum" NOT NULL DEFAULT 'db.r6g.large', "arn" character varying, "status" character varying, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "subnet_group_id" integer NOT NULL, CONSTRAINT "uq_memory_db_cluster_name_region" UNIQUE ("cluster_name", "region"), CONSTRAINT "uq_memory_db_cluster_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_b7461d91a0f9b5cda3a86a7da24" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster_security_groups" ("memory_db_cluster_id" integer NOT NULL, "memory_db_cluster_region" character varying NOT NULL, "security_group_id" integer NOT NULL, "security_group_region" character varying NOT NULL, CONSTRAINT "PK_4805a7c38f90492aee11e43fa3d" PRIMARY KEY ("memory_db_cluster_id", "memory_db_cluster_region", "security_group_id", "security_group_region"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d2cff85f9e69bf94cbb224ba9" ON "memory_db_cluster_security_groups" ("memory_db_cluster_id", "memory_db_cluster_region") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_44dca305b910352a3f7a356424" ON "memory_db_cluster_security_groups" ("security_group_id", "security_group_region") `,
    );
    await queryRunner.query(
      `ALTER TABLE "subnet_group" ADD CONSTRAINT "FK_9c167de4a925902861770929701" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" ADD CONSTRAINT "FK_88d06dfe65afb98a71707759361" FOREIGN KEY ("subnet_group_id", "region") REFERENCES "subnet_group"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" ADD CONSTRAINT "FK_6fd8e3f2d624960bc1ac10f4cea" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_0d2cff85f9e69bf94cbb224ba93" FOREIGN KEY ("memory_db_cluster_id", "memory_db_cluster_region") REFERENCES "memory_db_cluster"("id","region") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_44dca305b910352a3f7a356424e" FOREIGN KEY ("security_group_id", "security_group_region") REFERENCES "security_group"("id","region") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_44dca305b910352a3f7a356424e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_0d2cff85f9e69bf94cbb224ba93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_6fd8e3f2d624960bc1ac10f4cea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_88d06dfe65afb98a71707759361"`,
    );
    await queryRunner.query(`ALTER TABLE "subnet_group" DROP CONSTRAINT "FK_9c167de4a925902861770929701"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_44dca305b910352a3f7a356424"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0d2cff85f9e69bf94cbb224ba9"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster_security_groups"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster"`);
    await queryRunner.query(`DROP TYPE "public"."memory_db_cluster_node_type_enum"`);
    await queryRunner.query(`DROP TABLE "subnet_group"`);
  }
}
