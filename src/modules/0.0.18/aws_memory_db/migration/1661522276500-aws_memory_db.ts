import {MigrationInterface, QueryRunner} from "typeorm";

import * as sql from '../sql';

export class awsMemoryDb1661522276500 implements MigrationInterface {
    name = 'awsMemoryDb1661522276500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "subnet_group" ("id" SERIAL NOT NULL, "subnet_group_name" character varying NOT NULL, "description" character varying, "arn" character varying, "subnets" character varying array, CONSTRAINT "UQ_129b8295c594237d6cc4adee49a" UNIQUE ("subnet_group_name"), CONSTRAINT "PK_129b8295c594237d6cc4adee49a" PRIMARY KEY ("subnet_group_name"))`);
        await queryRunner.query(`CREATE TYPE "public"."memory_db_cluster_node_type_enum" AS ENUM('db.t4g.small', 'db.t4g.medium', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge', 'db.r6g.4xlarge', 'db.r6g.8xlarge', 'db.r6g.12xlarge', 'db.r6g.16xlarg')`);
        await queryRunner.query(`CREATE TABLE "memory_db_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "description" character varying, "address" character varying, "port" integer NOT NULL DEFAULT '6379', "node_type" "public"."memory_db_cluster_node_type_enum" NOT NULL DEFAULT 'db.r6g.large', "arn" character varying, "status" character varying, "tags" json, "subnet_group" character varying NOT NULL, CONSTRAINT "UQ_9b58d9ed9d73bbf926f0250eedf" UNIQUE ("cluster_name"), CONSTRAINT "PK_b7461d91a0f9b5cda3a86a7da24" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "memory_db_cluster_security_groups" ("memory_db_cluster_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_7e87bbcf6a72ca299ad58fb8915" PRIMARY KEY ("memory_db_cluster_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f8d300474415c8556e3d7fd7fa" ON "memory_db_cluster_security_groups" ("memory_db_cluster_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_934dbce49712bcc04e479d551c" ON "memory_db_cluster_security_groups" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster" ADD CONSTRAINT "FK_ecc3d27115a2a83152a4622b57b" FOREIGN KEY ("subnet_group") REFERENCES "subnet_group"("subnet_group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_f8d300474415c8556e3d7fd7fa9" FOREIGN KEY ("memory_db_cluster_id") REFERENCES "memory_db_cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster_security_groups" ADD CONSTRAINT "FK_934dbce49712bcc04e479d551cf" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(sql.createCustomConstraints);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(sql.dropCustomConstraints);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_934dbce49712bcc04e479d551cf"`);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "FK_f8d300474415c8556e3d7fd7fa9"`);
        await queryRunner.query(`ALTER TABLE "memory_db_cluster" DROP CONSTRAINT "FK_ecc3d27115a2a83152a4622b57b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_934dbce49712bcc04e479d551c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8d300474415c8556e3d7fd7fa"`);
        await queryRunner.query(`DROP TABLE "memory_db_cluster_security_groups"`);
        await queryRunner.query(`DROP TABLE "memory_db_cluster"`);
        await queryRunner.query(`DROP TYPE "public"."memory_db_cluster_node_type_enum"`);
        await queryRunner.query(`DROP TABLE "subnet_group"`);
    }

}
