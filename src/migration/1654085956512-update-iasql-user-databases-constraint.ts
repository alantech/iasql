import { MigrationInterface, QueryRunner } from 'typeorm';

export class updateIasqlUserDatabasesConstraint1654085956512 implements MigrationInterface {
  name = 'updateIasqlUserDatabasesConstraint1654085956512';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_user_databases" DROP CONSTRAINT "FK_bf1aea71128550cf56ef89078be"`);
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" ADD CONSTRAINT "FK_bf1aea71128550cf56ef89078be" FOREIGN KEY ("iasql_database_pg_name") REFERENCES "iasql_database"("pg_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "iasql_user_databases" DROP CONSTRAINT "FK_bf1aea71128550cf56ef89078be"`);
    await queryRunner.query(
      `ALTER TABLE "iasql_user_databases" ADD CONSTRAINT "FK_bf1aea71128550cf56ef89078be" FOREIGN KEY ("iasql_database_pg_name") REFERENCES "iasql_database"("pg_name") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }
}
