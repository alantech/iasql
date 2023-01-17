import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSns1673873270230 implements MigrationInterface {
  name = 'awsSns1673873270230';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "topic" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "delivery_policy" character varying, "display_name" character varying, "policy" character varying, "tracing_config" character varying, "kms_master_key_id" character varying, "signature_version" character varying, "content_based_deduplication" character varying, "fifo_topic" boolean NOT NULL DEFAULT false, "data_protection_policy" json, "arn" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_4465ce11b1b4d787a9e7f9539c9" UNIQUE ("arn"), CONSTRAINT "uq_topic_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_33aa4ecb4e4f20aa0157ea7ef61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic" ADD CONSTRAINT "FK_a8a24525e870ae4ec478e78110e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "topic" DROP CONSTRAINT "FK_a8a24525e870ae4ec478e78110e"`);
    await queryRunner.query(`DROP TABLE "topic"`);
  }
}
