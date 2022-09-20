import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsDynamo1663707996014 implements MigrationInterface {
  name = 'awsDynamo1663707996014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."dynamo_table_table_class_enum" AS ENUM('STANDARD', 'STANDARD_INFREQUENT_ACCESS')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dynamo_table" ("id" SERIAL NOT NULL, "table_name" character varying NOT NULL, "table_class" "public"."dynamo_table_table_class_enum" NOT NULL, "throughput" json NOT NULL, "table_id" character varying, "primary_key" json NOT NULL, "created_at" TIMESTAMP, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_d88faa91b7a7a9cb17ee75e576b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "dynamo_table" ADD CONSTRAINT "FK_00825dbac36881b9ebc3b79b78c" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dynamo_table" DROP CONSTRAINT "FK_00825dbac36881b9ebc3b79b78c"`);
    await queryRunner.query(`DROP TABLE "dynamo_table"`);
    await queryRunner.query(`DROP TYPE "public"."dynamo_table_table_class_enum"`);
  }
}
