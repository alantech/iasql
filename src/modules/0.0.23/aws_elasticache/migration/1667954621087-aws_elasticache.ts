import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsElasticache1667954621087 implements MigrationInterface {
  name = 'awsElasticache1667954621087';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."cache_cluster_engine_enum" AS ENUM('memcached', 'redis')`);
    await queryRunner.query(
      `CREATE TABLE "cache_cluster" ("id" SERIAL NOT NULL, "cluster_id" character varying NOT NULL, "node_type" character varying, "engine" "public"."cache_cluster_engine_enum" NOT NULL DEFAULT 'redis', "num_nodes" integer, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_1fccb6ea902a800c5f36255fa06" PRIMARY KEY ("id"))`,
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
