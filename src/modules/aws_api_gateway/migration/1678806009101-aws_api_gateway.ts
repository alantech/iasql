import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsApiGateway1678806009101 implements MigrationInterface {
  name = 'awsApiGateway1678806009101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."api_protocol_type_enum" AS ENUM('HTTP', 'WEBSOCKET')`);
    await queryRunner.query(
      `CREATE TABLE "api" ("id" SERIAL NOT NULL, "api_id" character varying, "name" character varying, "description" character varying, "disable_execute_api_endpoint" boolean, "protocol_type" "public"."api_protocol_type_enum", "version" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), "tags" json, CONSTRAINT "PK_12f6cbe9e79197c2bf4c79c009d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "api" ADD CONSTRAINT "FK_49eda141b7f204f34bb34e3f357" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api" DROP CONSTRAINT "FK_49eda141b7f204f34bb34e3f357"`);
    await queryRunner.query(`DROP TABLE "api"`);
    await queryRunner.query(`DROP TYPE "public"."api_protocol_type_enum"`);
  }
}
