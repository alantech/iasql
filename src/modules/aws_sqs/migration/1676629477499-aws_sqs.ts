import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSqs1676629477499 implements MigrationInterface {
  name = 'awsSqs1676629477499';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "queue" ("id" SERIAL NOT NULL, "url" character varying, "name" character varying NOT NULL, "fifo_queue" boolean NOT NULL DEFAULT false, "visibility_timeout" integer NOT NULL DEFAULT '30', "delay_seconds" integer NOT NULL DEFAULT '0', "receive_message_wait_time_seconds" integer NOT NULL DEFAULT '0', "message_retention_period" integer NOT NULL DEFAULT '345600', "maximum_message_size" integer NOT NULL DEFAULT '262144', "policy" json, "arn" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_519fda5975fbe7a3a379e5d3b54" UNIQUE ("arn"), CONSTRAINT "PK_4adefbd9c73b3f9a49985a5529f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue" ADD CONSTRAINT "FK_09d630f7b20e3ab25429d442639" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue" DROP CONSTRAINT "FK_09d630f7b20e3ab25429d442639"`);
    await queryRunner.query(`DROP TABLE "queue"`);
  }
}
