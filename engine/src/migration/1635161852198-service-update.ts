import {MigrationInterface, QueryRunner} from "typeorm";

export class serviceUpdate1635161852198 implements MigrationInterface {
    name = 'serviceUpdate1635161852198'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."service_launch_type_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TYPE "public"."service_scheduling_strategy_enum" AS ENUM('DAEMON', 'REPLICA')`);
        await queryRunner.query(`CREATE TABLE "service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "launch_type" "public"."service_launch_type_enum" NOT NULL, "scheduling_strategy" "public"."service_scheduling_strategy_enum" NOT NULL, "cluster_id" integer, "task_definition_id" integer, CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE ("name"), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7" FOREIGN KEY ("cluster_id") REFERENCES "cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7"`);
        await queryRunner.query(`DROP TABLE "service"`);
        await queryRunner.query(`DROP TYPE "public"."service_scheduling_strategy_enum"`);
        await queryRunner.query(`DROP TYPE "public"."service_launch_type_enum"`);
    }

}
