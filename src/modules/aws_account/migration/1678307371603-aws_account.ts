import { MigrationInterface, QueryRunner } from "typeorm";

export class awsAccount1678307371603 implements MigrationInterface {
    name = 'awsAccount1678307371603'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_credentials" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "session_token" character varying, CONSTRAINT "PK_dd50eeb7ab9f2b49389ecd659f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_regions" ("region" character varying NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "is_enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_60264a4f4afcbdf73a1ef081235" PRIMARY KEY ("region"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "aws_regions"`);
        await queryRunner.query(`DROP TABLE "aws_credentials"`);
    }

}
