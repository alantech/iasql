import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsElasticache1666175240591 implements MigrationInterface {
  name = 'awsElasticache1666175240591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."cache_cluster_engine_enum" AS ENUM('memcached', 'redis')`);
    await queryRunner.query(
      `CREATE TABLE "cache_cluster" ("cluster_id" character varying NOT NULL, "node_type" character varying, "engine" "public"."cache_cluster_engine_enum" NOT NULL DEFAULT 'redis', "num_nodes" integer, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_32e0c1ead270ed531c641fe80a1" PRIMARY KEY ("cluster_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "cache_cluster" ADD CONSTRAINT "FK_a77384cee59c38eb61061170af1" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cache_cluster" DROP CONSTRAINT "FK_a77384cee59c38eb61061170af1"`);
    await queryRunner.query(`DROP TABLE "cache_cluster"`);
    await queryRunner.query(`DROP TYPE "public"."cache_cluster_engine_enum"`);
  }
}
