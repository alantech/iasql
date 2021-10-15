import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCredentials1634317381822 implements MigrationInterface {
    name = 'awsCredentials1634317381822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_credentials" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "UQ_b59044425928a1161cf75c8c491" UNIQUE ("access_key_id"), CONSTRAINT "UQ_15ef7447f0656b630dd129c345b" UNIQUE ("secret_access_key"), CONSTRAINT "PK_dd50eeb7ab9f2b49389ecd659f9" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "aws_credentials"`);
    }

}
