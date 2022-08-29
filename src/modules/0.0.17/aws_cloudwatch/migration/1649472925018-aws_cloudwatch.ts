import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCloudwatch1649472925018 implements MigrationInterface {
  name = 'awsCloudwatch1649472925018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "log_group" ("log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6d8521becbc3f536b29ee07dc57" PRIMARY KEY ("log_group_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "log_group"`);
  }
}
