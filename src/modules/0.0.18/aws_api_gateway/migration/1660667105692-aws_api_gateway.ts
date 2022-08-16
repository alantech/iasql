import {MigrationInterface, QueryRunner} from "typeorm";

export class awsApiGateway1660667105692 implements MigrationInterface {
    name = 'awsApiGateway1660667105692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rest_api" ("id" SERIAL NOT NULL, "rest_api_id" character varying, "name" character varying NOT NULL, "description" character varying, "disable_execute_api_endpoint" boolean, "version" character varying, "policy" json, CONSTRAINT "PK_a67529a21f5aa708555b12d6416" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rest_api"`);
    }

}
