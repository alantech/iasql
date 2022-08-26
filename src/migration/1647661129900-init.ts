import { MigrationInterface, QueryRunner } from 'typeorm';

export class init1647661129900 implements MigrationInterface {
  name = 'init1647661129900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "iasql_database" ("pg_name" character varying NOT NULL, "alias" character varying NOT NULL, "region" character varying NOT NULL, "pg_user" character varying NOT NULL, CONSTRAINT "PK_a70daf5038ee78e1a4e5cb78990" PRIMARY KEY ("pg_name"))`
    );
    await queryRunner.query(
      `CREATE TABLE "iasql_user" ("id" character varying NOT NULL, "email" character varying NOT NULL, CONSTRAINT "PK_3324df41f4e885452f09f3e147e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "iasql_user_databases" ("iasql_user_id" character varying NOT NULL, "iasql_database_pg_name" character varying NOT NULL, CONSTRAINT "PK_6792136f2a5b23bd9efd2c3e4d8" PRIMARY KEY ("iasql_user_id", "iasql_database_pg_name"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94a9d6689be180267b380def44" ON "iasql_user_databases" ("iasql_user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf1aea71128550cf56ef89078b" ON "iasql_user_databases" ("iasql_database_pg_name") `
    );
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" ADD CONSTRAINT "FK_94a9d6689be180267b380def44c" FOREIGN KEY ("iasql_user_id") REFERENCES "iasql_user"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" ADD CONSTRAINT "FK_bf1aea71128550cf56ef89078be" FOREIGN KEY ("iasql_database_pg_name") REFERENCES "iasql_database"("pg_name") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" DROP CONSTRAINT "FK_bf1aea71128550cf56ef89078be"`
    );
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" DROP CONSTRAINT "FK_94a9d6689be180267b380def44c"`
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_bf1aea71128550cf56ef89078b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_94a9d6689be180267b380def44"`);
    await queryRunner.query(`DROP TABLE "iasql_user_databases"`);
    await queryRunner.query(`DROP TABLE "iasql_user"`);
    await queryRunner.query(`DROP TABLE "iasql_database"`);
  }
}
