import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsMemoryDb1663863394205 implements MigrationInterface {
  name = 'awsMemoryDb1663863394205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subnet_group" ("id" SERIAL NOT NULL, "subnet_group_name" character varying NOT NULL, "description" character varying, "arn" character varying, "subnets" character varying array, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_129b8295c594237d6cc4adee49a" UNIQUE ("subnet_group_name"), CONSTRAINT "PK_5fab07dbefa8d5e47d672ae0956" PRIMARY KEY ("subnet_group_name", "region"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memory_db_cluster_node_type_enum" AS ENUM('db.t4g.small', 'db.t4g.medium', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge', 'db.r6g.4xlarge', 'db.r6g.8xlarge', 'db.r6g.12xlarge', 'db.r6g.16xlarg')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "description" character varying, "address" character varying, "port" integer NOT NULL DEFAULT '6379', "node_type" "public"."memory_db_cluster_node_type_enum" NOT NULL DEFAULT 'db.r6g.large', "arn" character varying, "status" character varying, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "subnet_group" character varying NOT NULL, CONSTRAINT "UQ_9b58d9ed9d73bbf926f0250eedf" UNIQUE ("cluster_name"), CONSTRAINT "PK_87b3287fd549e4b69f69d29c9c9" PRIMARY KEY ("id", "region"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_db_cluster_security_groups" ("memory_db_cluster_id" integer NOT NULL, "memory_db_cluster_region" character varying NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_5b506d5ba15972d2b6fffe15d27" PRIMARY KEY ("memory_db_cluster_id", "memory_db_cluster_region", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d2cff85f9e69bf94cbb224ba9" ON "memory_db_cluster_security_groups" ("memory_db_cluster_id", "memory_db_cluster_region") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_934dbce49712bcc04e479d551c" ON "memory_db_cluster_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" ADD CONSTRAINT "FK_781bc7e9528fff1b021e25e73b1" FOREIGN KEY ("subnet_group", "region") REFERENCES "subnet_group"("subnet_group_name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_0d2cff85f9e69bf94cbb224ba93" FOREIGN KEY ("memory_db_cluster_id", "memory_db_cluster_region") REFERENCES "memory_db_cluster"("id","region") ON DELETE CASCADE ON UPDATE CASCADE`,
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
      `ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_0d2cff85f9e69bf94cbb224ba93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_781bc7e9528fff1b021e25e73b1"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_934dbce49712bcc04e479d551c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0d2cff85f9e69bf94cbb224ba9"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster_security_groups"`);
    await queryRunner.query(`DROP TABLE "memory_db_cluster"`);
    await queryRunner.query(`DROP TYPE "public"."memory_db_cluster_node_type_enum"`);
    await queryRunner.query(`DROP TABLE "subnet_group"`);
  }
}
