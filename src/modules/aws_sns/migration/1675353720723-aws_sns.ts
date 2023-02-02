import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSns1675353720723 implements MigrationInterface {
  name = 'awsSns1675353720723';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "topic" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "delivery_policy" character varying, "display_name" character varying, "policy" character varying, "tracing_config" character varying, "kms_master_key_id" character varying, "signature_version" character varying, "content_based_deduplication" character varying, "fifo_topic" boolean NOT NULL DEFAULT false, "data_protection_policy" json, "arn" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_4465ce11b1b4d787a9e7f9539c9" UNIQUE ("arn"), CONSTRAINT "uq_topic_arn" UNIQUE ("arn"), CONSTRAINT "uq_topic_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_33aa4ecb4e4f20aa0157ea7ef61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" SERIAL NOT NULL, "endpoint" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), "protocol" character varying NOT NULL, "arn" character varying, "topic" character varying, CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic" ADD CONSTRAINT "FK_a8a24525e870ae4ec478e78110e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_0cfc83592dbf7a0e4fcd12128b5" FOREIGN KEY ("topic") REFERENCES "topic"("arn") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_4489f38bf18f6903cbe7a80a40d" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_4489f38bf18f6903cbe7a80a40d"`);
    await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_0cfc83592dbf7a0e4fcd12128b5"`);
    await queryRunner.query(`ALTER TABLE "topic" DROP CONSTRAINT "FK_a8a24525e870ae4ec478e78110e"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
    await queryRunner.query(`DROP TABLE "topic"`);
  }
}
