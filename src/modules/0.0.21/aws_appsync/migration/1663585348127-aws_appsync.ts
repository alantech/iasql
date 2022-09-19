import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAppsync1663585348127 implements MigrationInterface {
    name = 'awsAppsync1663585348127'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."graphql_api_authentication_type_enum" AS ENUM('AMAZON_COGNITO_USER_POOLS', 'API_KEY', 'AWS_IAM', 'AWS_LAMBDA', 'OPENID_CONNECT')`);
        await queryRunner.query(`CREATE TABLE "graphql_api" ("name" character varying NOT NULL, "api_id" character varying, "arn" character varying, "authentication_type" "public"."graphql_api_authentication_type_enum" NOT NULL, "lambda_authorizer_config" json, "open_id_connect_config" json, "user_pool_config" json, CONSTRAINT "PK_e7abe8b081f9bf5ac18f74189f8" PRIMARY KEY ("name"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "graphql_api"`);
        await queryRunner.query(`DROP TYPE "public"."graphql_api_authentication_type_enum"`);
    }

}
