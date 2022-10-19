import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsS31665766666595 implements MigrationInterface {
  name = 'awsS31665766666595';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bucket" ("name" character varying NOT NULL, "policy_document" json, "created_at" TIMESTAMP, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_bucket_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_7bd6e5be634c7e3eb1f2474047a" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket" ADD CONSTRAINT "FK_853de0389dae8e56caece1fa5da" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bucket" DROP CONSTRAINT "FK_853de0389dae8e56caece1fa5da"`);
    await queryRunner.query(`DROP TABLE "bucket"`);
  }
}
