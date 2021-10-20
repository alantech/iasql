import {MigrationInterface, QueryRunner} from "typeorm";

export class init1634684458642 implements MigrationInterface {
    name = 'init1634684458642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "iasql_module" ("name" character varying NOT NULL, "installed" boolean NOT NULL, "enabled" boolean NOT NULL, CONSTRAINT "UQ_e91a0b0e9a029428405fdd17ee4" UNIQUE ("name"), CONSTRAINT "PK_e91a0b0e9a029428405fdd17ee4" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "iasql_dependencies" ("module" character varying NOT NULL, "dependency" character varying NOT NULL, CONSTRAINT "PK_b07797cfc364fa84b6da165f89d" PRIMARY KEY ("module", "dependency"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9732df6d7dff34b6f6a1732033" ON "iasql_dependencies" ("module") `);
        await queryRunner.query(`CREATE INDEX "IDX_7dbdaef2c45fdd0d1d82cc9568" ON "iasql_dependencies" ("dependency") `);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b" FOREIGN KEY ("module") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" ADD CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c" FOREIGN KEY ("dependency") REFERENCES "iasql_module"("name") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_7dbdaef2c45fdd0d1d82cc9568c"`);
        await queryRunner.query(`ALTER TABLE "iasql_dependencies" DROP CONSTRAINT "FK_9732df6d7dff34b6f6a1732033b"`);
        await queryRunner.query(`DROP INDEX "IDX_7dbdaef2c45fdd0d1d82cc9568"`);
        await queryRunner.query(`DROP INDEX "IDX_9732df6d7dff34b6f6a1732033"`);
        await queryRunner.query(`DROP TABLE "iasql_dependencies"`);
        await queryRunner.query(`DROP TABLE "iasql_module"`);
    }

}
