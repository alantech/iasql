import { MigrationInterface, QueryRunner } from 'typeorm';

import * as sql from '../sql';

export class iasqlFunctions1649177003917 implements MigrationInterface {
  name = 'iasqlFunctions1649177003917';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."iasql_operation_optype_enum" AS ENUM('APPLY', 'SYNC', 'INSTALL', 'UNINSTALL', 'PLAN_APPLY', 'PLAN_SYNC', 'LIST', 'UPGRADE')`
    );
    await queryRunner.query(
      `CREATE TABLE "iasql_operation" ("opid" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE, "optype" "public"."iasql_operation_optype_enum" NOT NULL, "params" text array NOT NULL, "output" text, "err" text, CONSTRAINT "PK_edf11c327fef1bf78dd04cdf3ce" PRIMARY KEY ("opid"))`
    );
    await queryRunner.query(sql.createFns);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(sql.dropFns);
    await queryRunner.query(`DROP TABLE "iasql_operation"`);
    await queryRunner.query(`DROP TYPE "public"."iasql_operation_optype_enum"`);
  }
}
