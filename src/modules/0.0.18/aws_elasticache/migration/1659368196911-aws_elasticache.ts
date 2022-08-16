import {MigrationInterface, QueryRunner} from "typeorm";

export class awsElasticache1659368196911 implements MigrationInterface {
    name = 'awsElasticache1659368196911'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."cache_cluster_engine_enum" AS ENUM('memcached', 'redis')`);
        await queryRunner.query(`CREATE TABLE "cache_cluster" ("cluster_id" character varying NOT NULL, "node_type" character varying, "engine" "public"."cache_cluster_engine_enum" NOT NULL DEFAULT 'redis', "num_nodes" integer, CONSTRAINT "PK_32e0c1ead270ed531c641fe80a1" PRIMARY KEY ("cluster_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "cache_cluster"`);
        await queryRunner.query(`DROP TYPE "public"."cache_cluster_engine_enum"`);
    }

}
