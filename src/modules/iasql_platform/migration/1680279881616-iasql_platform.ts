import { MigrationInterface, QueryRunner } from 'typeorm';

export class iasqlPlatform1680279881616 implements MigrationInterface {
  name = 'iasqlPlatform1680279881616';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "iasql_module"
                             (
                                 "name" character varying NOT NULL,
                                 CONSTRAINT "UQ_e91a0b0e9a029428405fdd17ee4" UNIQUE ("name"),
                                 CONSTRAINT "PK_e91a0b0e9a029428405fdd17ee4" PRIMARY KEY ("name")
                             )`);
    await queryRunner.query(`CREATE TABLE "iasql_tables"
                             (
                                 "module" character varying NOT NULL,
                                 "table"  character varying NOT NULL,
                                 CONSTRAINT "PK_2e2832f9cf90115571eb803a943" PRIMARY KEY ("module", "table")
                             )`);
    await queryRunner.query(
      `CREATE TYPE "public"."iasql_audit_log_change_type_enum" AS ENUM('INSERT', 'UPDATE', 'DELETE', 'START_COMMIT', 'PREVIEW_START_COMMIT', 'END_COMMIT', 'PREVIEW_END_COMMIT', 'OPEN_TRANSACTION', 'CLOSE_TRANSACTION', 'ERROR', 'START_REVERT', 'END_REVERT', 'SET_COMMIT_MESSAGE')`,
    );
    await queryRunner.query(`CREATE TABLE "iasql_audit_log"
                             (
                                 "id"             SERIAL                                      NOT NULL,
                                 "ts"             TIMESTAMP WITH TIME ZONE                    NOT NULL,
                                 "user"           character varying                           NOT NULL,
                                 "table_name"     character varying                           NOT NULL,
                                 "change_type"    "public"."iasql_audit_log_change_type_enum" NOT NULL,
                                 "change"         json                                        NOT NULL,
                                 "message"        character varying,
                                 "transaction_id" character varying,
                                 CONSTRAINT "PK_96a7317761701ced55a158c195d" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`CREATE INDEX "IDX_ff85981b261fe1c34027ed6f41" ON "iasql_audit_log" ("ts") `);
    await queryRunner.query(`CREATE TABLE "iasql_dependencies"
                             (
                                 "module"     character varying NOT NULL,
                                 "dependency" character varying NOT NULL,
                                 CONSTRAINT "PK_b07797cfc364fa84b6da165f89d" PRIMARY KEY ("module", "dependency")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_9732df6d7dff34b6f6a1732033" ON "iasql_dependencies" ("module") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7dbdaef2c45fdd0d1d82cc9568" ON "iasql_dependencies" ("dependency") `,
    );
    await queryRunner.query(`ALTER TABLE "iasql_tables"
        ADD CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb" FOREIGN KEY ("module") REFERENCES "iasql_module" ("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "iasql_dependencies"
        ADD CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b" FOREIGN KEY ("module") REFERENCES "iasql_module" ("name") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "iasql_dependencies"
        ADD CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c" FOREIGN KEY ("dependency") REFERENCES "iasql_module" ("name") ON DELETE CASCADE ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_dependencies"
        DROP CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c"`);
    await queryRunner.query(`ALTER TABLE "iasql_dependencies"
        DROP CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b"`);
    await queryRunner.query(`ALTER TABLE "iasql_tables"
        DROP CONSTRAINT "FK_0e0f2a4ef99e93cfcb935c060cb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7dbdaef2c45fdd0d1d82cc9568"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9732df6d7dff34b6f6a1732033"`);
    await queryRunner.query(`DROP TABLE "iasql_dependencies"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ff85981b261fe1c34027ed6f41"`);
    await queryRunner.query(`DROP TABLE "iasql_audit_log"`);
    await queryRunner.query(`DROP TYPE "public"."iasql_audit_log_change_type_enum"`);
    await queryRunner.query(`DROP TABLE "iasql_tables"`);
    await queryRunner.query(`DROP TABLE "iasql_module"`);
  }
}
