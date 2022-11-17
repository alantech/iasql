import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCloudwatch1666174979986 implements MigrationInterface {
  name = 'awsCloudwatch1666174979986';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "log_group" ("id" SERIAL NOT NULL, "log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_98524f243181f6e4ef712642235" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0debae85724e7e1b623c556fb0" ON "log_group" ("log_group_name", "region") `,
    );
    await queryRunner.query(
      `ALTER TABLE "log_group" ADD CONSTRAINT "FK_8eb78fd886deb6f20a15088e8c6" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "log_group" DROP CONSTRAINT "FK_8eb78fd886deb6f20a15088e8c6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0debae85724e7e1b623c556fb0"`);
    await queryRunner.query(`DROP TABLE "log_group"`);
  }
}
