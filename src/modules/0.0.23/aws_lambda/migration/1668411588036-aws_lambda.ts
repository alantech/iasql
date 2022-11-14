import {MigrationInterface, QueryRunner} from "typeorm";

export class awsLambda1668411588036 implements MigrationInterface {
    name = 'awsLambda1668411588036'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."lambda_function_runtime_enum" AS ENUM('dotnet6', 'dotnetcore1.0', 'dotnetcore2.0', 'dotnetcore2.1', 'dotnetcore3.1', 'go1.x', 'java11', 'java8', 'java8.al2', 'nodejs', 'nodejs10.x', 'nodejs12.x', 'nodejs14.x', 'nodejs16.x', 'nodejs4.3', 'nodejs4.3-edge', 'nodejs6.10', 'nodejs8.10', 'provided', 'provided.al2', 'python2.7', 'python3.6', 'python3.7', 'python3.8', 'python3.9', 'ruby2.5', 'ruby2.7')`);
        await queryRunner.query(`CREATE TYPE "public"."lambda_function_package_type_enum" AS ENUM('Zip')`);
        await queryRunner.query(`CREATE TYPE "public"."lambda_function_architecture_enum" AS ENUM('arm64', 'x86_64')`);
        await queryRunner.query(`CREATE TABLE "lambda_function" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "version" character varying NOT NULL DEFAULT '$LATEST', "description" character varying, "zip_b64" character varying, "handler" character varying, "runtime" "public"."lambda_function_runtime_enum", "package_type" "public"."lambda_function_package_type_enum" NOT NULL DEFAULT 'Zip', "architecture" "public"."lambda_function_architecture_enum" NOT NULL DEFAULT 'x86_64', "memory_size" integer NOT NULL DEFAULT '128', "environment" json, "tags" json, "subnets" character varying array, "region" character varying NOT NULL DEFAULT default_aws_region(), "role_name" character varying, CONSTRAINT "uq_lambda_region" UNIQUE ("name", "region"), CONSTRAINT "CHK_lambda_handler__package_type" CHECK (("package_type" = 'Zip' AND "handler" IS NOT NULL) OR "package_type" != 'Zip'), CONSTRAINT "CHK_lambda_runtime__package_type" CHECK (("package_type" = 'Zip' AND "runtime" IS NOT NULL) OR "package_type" != 'Zip'), CONSTRAINT "PK_047cc4e8b0922f375f48b74c2d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "lambda_function_security_groups" ("lambda_function_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_70f7b122dd48bc798ef03affda9" PRIMARY KEY ("lambda_function_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_17bc65f40b84a9359b0455e3a4" ON "lambda_function_security_groups" ("lambda_function_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0bc60a723ea0106b86ac8aabeb" ON "lambda_function_security_groups" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "lambda_function" ADD CONSTRAINT "FK_e326decbc2b59a537bb9ee68ab9" FOREIGN KEY ("role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lambda_function" ADD CONSTRAINT "FK_544ef802e761e12c43a2b63ca13" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lambda_function_security_groups" ADD CONSTRAINT "FK_17bc65f40b84a9359b0455e3a48" FOREIGN KEY ("lambda_function_id") REFERENCES "lambda_function"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "lambda_function_security_groups" ADD CONSTRAINT "FK_0bc60a723ea0106b86ac8aabeb5" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lambda_function_security_groups" DROP CONSTRAINT "FK_0bc60a723ea0106b86ac8aabeb5"`);
        await queryRunner.query(`ALTER TABLE "lambda_function_security_groups" DROP CONSTRAINT "FK_17bc65f40b84a9359b0455e3a48"`);
        await queryRunner.query(`ALTER TABLE "lambda_function" DROP CONSTRAINT "FK_544ef802e761e12c43a2b63ca13"`);
        await queryRunner.query(`ALTER TABLE "lambda_function" DROP CONSTRAINT "FK_e326decbc2b59a537bb9ee68ab9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bc60a723ea0106b86ac8aabeb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17bc65f40b84a9359b0455e3a4"`);
        await queryRunner.query(`DROP TABLE "lambda_function_security_groups"`);
        await queryRunner.query(`DROP TABLE "lambda_function"`);
        await queryRunner.query(`DROP TYPE "public"."lambda_function_architecture_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lambda_function_package_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lambda_function_runtime_enum"`);
    }

}
