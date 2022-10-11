import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsMemoryDb1665496433778 implements MigrationInterface {
  name = 'awsMemoryDb1665496433778';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subnet_group" ("id" SERIAL NOT NULL, "subnet_group_name" character varying NOT NULL, "description" character varying, "arn" character varying, "subnets" character varying array, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_subnet_group_name_region" UNIQUE ("subnet_group_name", "region"), CONSTRAINT "uq_subnet_group_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_a54731069caf05d2029dc7cd4c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memory_db_cluster_node_type_enum" AS ENUM('db.t4g.small', 'db.t4g.medium', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge', 'db.r6g.4xlarge', 'db.r6g.8xlarge', 'db.r6g.12xlarge', 'db.r6g.16xlarg')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "description" character varying, "address" character varying, "port" integer NOT NULL DEFAULT '6379', "node_type" "public"."memory_db_cluster_node_type_enum" NOT NULL DEFAULT 'db.r6g.large', "arn" character varying, "status" character varying, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "subnet_group_id" integer NOT NULL, CONSTRAINT "uq_memory_db_cluster_name_region" UNIQUE ("cluster_name", "region"), CONSTRAINT "uq_memory_db_cluster_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_b7461d91a0f9b5cda3a86a7da24" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster_security_groups" ("memory_db_cluster_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_7e87bbcf6a72ca299ad58fb8915" PRIMARY KEY ("memory_db_cluster_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8d300474415c8556e3d7fd7fa" ON "memory_db_cluster_security_groups" ("memory_db_cluster_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_934dbce49712bcc04e479d551c" ON "memory_db_cluster_security_groups" ("security_group_id") `,
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
      `ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_f8d300474415c8556e3d7fd7fa9" FOREIGN KEY ("memory_db_cluster_id") REFERENCES "memory_db_cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_934dbce49712bcc04e479d551cf" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_934dbce49712bcc04e479d551cf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_f8d300474415c8556e3d7fd7fa9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_6fd8e3f2d624960bc1ac10f4cea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_88d06dfe65afb98a71707759361"`,
    );
    await queryRunner.query(`ALTER TABLE "subnet_group" DROP CONSTRAINT "FK_9c167de4a925902861770929701"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_934dbce49712bcc04e479d551c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f8d300474415c8556e3d7fd7fa"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster_security_groups"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster"`);
    await queryRunner.query(`DROP TYPE "public"."memory_db_cluster_node_type_enum"`);
    await queryRunner.query(`DROP TABLE "subnet_group"`);
  }
}
