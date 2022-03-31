import fs from 'fs'
import {MigrationInterface, QueryRunner} from "typeorm";

export class init1648611800868 implements MigrationInterface {
    name = 'init1648611800868'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "iasql_module" ("name" character varying NOT NULL, CONSTRAINT "UQ_e91a0b0e9a029428405fdd17ee4" UNIQUE ("name"), CONSTRAINT "PK_e91a0b0e9a029428405fdd17ee4" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "iasql_tables" ("table" character varying NOT NULL, "module" character varying NOT NULL, CONSTRAINT "PK_2e2832f9cf90115571eb803a943" PRIMARY KEY ("table", "module"))`);
        await queryRunner.query(`CREATE TYPE "public"."iasql_operation_optype_enum" AS ENUM('APPLY', 'SYNC', 'INSTALL', 'UNINSTALL', 'PLAN_APPLY', 'PLAN_SYNC', 'LIST')`);
        await queryRunner.query(`CREATE TABLE "iasql_operation" ("opid" uuid NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "end_date" TIMESTAMP WITH TIME ZONE, "optype" "public"."iasql_operation_optype_enum" NOT NULL, "params" text array NOT NULL, "output" text, "err" text, CONSTRAINT "PK_edf11c327fef1bf78dd04cdf3ce" PRIMARY KEY ("opid"))`);
        await queryRunner.query(`CREATE TABLE "iasql_dependencies" ("module" character varying NOT NULL, "dependency" character varying NOT NULL, CONSTRAINT "PK_b07797cfc364fa84b6da165f89d" PRIMARY KEY ("module", "dependency"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9732df6d7dff34b6f6a1732033" ON "iasql_dependencies" ("module") `);
        await queryRunner.query(`CREATE INDEX "IDX_7dbdaef2c45fdd0d1d82cc9568" ON "iasql_dependencies" ("dependency") `);
        await queryRunner.query(`ALTER TABLE "iasql_tables" ADD CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb" FOREIGN KEY ("module") REFERENCES "iasql_module"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b" FOREIGN KEY ("module") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c" FOREIGN KEY ("dependency") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(fs.readFileSync(`${__dirname}/../../sql/create_fns.sql`, 'utf8'));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(fs.readFileSync(`${__dirname}../../sql/drop_fns.sql`, 'utf8'));
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c"`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b"`);
        await queryRunner.query(`ALTER TABLE "iasql_tables" DROP CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7dbdaef2c45fdd0d1d82cc9568"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9732df6d7dff34b6f6a1732033"`);
        await queryRunner.query(`DROP TABLE "iasql_dependencies"`);
        await queryRunner.query(`DROP TABLE "iasql_operation"`);
        await queryRunner.query(`DROP TYPE "public"."iasql_operation_optype_enum"`);
        await queryRunner.query(`DROP TABLE "iasql_tables"`);
        await queryRunner.query(`DROP TABLE "iasql_module"`);
    }

}
