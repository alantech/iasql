import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsLambda1658749020346 implements MigrationInterface {
  name = 'awsLambda1658749020346';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lambda_function_runtime_enum" AS ENUM('dotnet6', 'dotnetcore1.0', 'dotnetcore2.0', 'dotnetcore2.1', 'dotnetcore3.1', 'go1.x', 'java11', 'java8', 'java8.al2', 'nodejs', 'nodejs10.x', 'nodejs12.x', 'nodejs14.x', 'nodejs16.x', 'nodejs4.3', 'nodejs4.3-edge', 'nodejs6.10', 'nodejs8.10', 'provided', 'provided.al2', 'python2.7', 'python3.6', 'python3.7', 'python3.8', 'python3.9', 'ruby2.5', 'ruby2.7')`
    );
    await queryRunner.query(`CREATE TYPE "public"."lambda_function_package_type_enum" AS ENUM('Zip')`);
    await queryRunner.query(`CREATE TYPE "public"."lambda_function_architecture_enum" AS ENUM('arm64', 'x86_64')`);
    await queryRunner.query(
      `CREATE TABLE "lambda_function" ("name" character varying NOT NULL, "arn" character varying, "version" character varying NOT NULL DEFAULT '$LATEST', "description" character varying, "zip_b64" character varying, "handler" character varying, "runtime" "public"."lambda_function_runtime_enum", "package_type" "public"."lambda_function_package_type_enum" NOT NULL DEFAULT 'Zip', "architecture" "public"."lambda_function_architecture_enum" NOT NULL DEFAULT 'x86_64', "memory_size" integer NOT NULL DEFAULT '128', "environment" json, "tags" json, "role_name" character varying, CONSTRAINT "CHK_lambda_handler__package_type" CHECK (("package_type" = 'Zip' AND "handler" IS NOT NULL) OR "package_type" != 'Zip'), CONSTRAINT "CHK_lambda_runtime__package_type" CHECK (("package_type" = 'Zip' AND "runtime" IS NOT NULL) OR "package_type" != 'Zip'), CONSTRAINT "PK_c29c98bda01914d7de9c822c025" PRIMARY KEY ("name"))`
    );
    await queryRunner.query(
      `ALTER TABLE "lambda_function" ADD CONSTRAINT "FK_e326decbc2b59a537bb9ee68ab9" FOREIGN KEY ("role_name") REFERENCES "role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lambda_function" DROP CONSTRAINT "FK_e326decbc2b59a537bb9ee68ab9"`);
    await queryRunner.query(`DROP TABLE "lambda_function"`);
    await queryRunner.query(`DROP TYPE "public"."lambda_function_architecture_enum"`);
    await queryRunner.query(`DROP TYPE "public"."lambda_function_package_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."lambda_function_runtime_enum"`);
  }
}
