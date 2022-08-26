import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAccount1657321628367 implements MigrationInterface {
  name = 'awsAccount1657321628367';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "PK_9ad897024d8c36c541d7fe84084" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "aws_account"`);
  }
}
