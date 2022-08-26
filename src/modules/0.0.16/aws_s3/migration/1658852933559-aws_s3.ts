import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsS31658852933559 implements MigrationInterface {
  name = 'awsS31658852933559';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bucket" ("name" character varying NOT NULL, "policy_document" json, "created_at" TIMESTAMP, CONSTRAINT "PK_7bd6e5be634c7e3eb1f2474047a" PRIMARY KEY ("name"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bucket"`);
  }
}
