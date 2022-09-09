import {MigrationInterface, QueryRunner} from "typeorm";

export class iasqlFunctions1662718045398 implements MigrationInterface {
    name = 'iasqlFunctions1662718045398'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."iasql_operation_optype_enum" AS ENUM('APPLY', 'SYNC', 'INSTALL', 'UNINSTALL', 'PLAN_APPLY', 'PLAN_SYNC', 'LIST', 'UPGRADE')`);
        await queryRunner.query(`CREATE TABLE "iasql_operation" ("opid" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE, "optype" "public"."iasql_operation_optype_enum" NOT NULL, "params" text array NOT NULL, "output" text, "err" text, CONSTRAINT "PK_edf11c327fef1bf78dd04cdf3ce" PRIMARY KEY ("opid"))`);
        await queryRunner.query(`CREATE TABLE "iasql_rpc" ("opid" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE, "module_name" text NOT NULL, "method_name" text NOT NULL, "params" text array NOT NULL, "output" text, "err" text, CONSTRAINT "PK_9ab053e8d7c81139898a626bebf" PRIMARY KEY ("opid"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "iasql_rpc"`);
        await queryRunner.query(`DROP TABLE "iasql_operation"`);
        await queryRunner.query(`DROP TYPE "public"."iasql_operation_optype_enum"`);
    }

}
