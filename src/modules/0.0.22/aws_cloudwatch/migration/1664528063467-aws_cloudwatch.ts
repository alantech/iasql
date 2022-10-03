import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCloudwatch1664528063467 implements MigrationInterface {
  name = 'awsCloudwatch1664528063467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "log_group" ("id" SERIAL NOT NULL, "log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_98524f243181f6e4ef712642235" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0debae85724e7e1b623c556fb0" ON "log_group" ("log_group_name", "region") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_0debae85724e7e1b623c556fb0"`);
    await queryRunner.query(`DROP TABLE "log_group"`);
  }
}
