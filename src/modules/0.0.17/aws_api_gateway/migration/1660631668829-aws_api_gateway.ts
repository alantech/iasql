import {MigrationInterface, QueryRunner} from "typeorm";

export class awsApiGateway1660631668829 implements MigrationInterface {
    name = 'awsApiGateway1660631668829'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rest_api" ("rest_api_id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "disable_execute_api_endpoint" boolean, "version" character varying, "policy" json, CONSTRAINT "PK_c6e898d45d76d98723f8337c0ee" PRIMARY KEY ("rest_api_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rest_api"`);
    }

}
