import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsIam1671538339416 implements MigrationInterface {
  name = 'awsIam1671538339416';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "iam_role" ("arn" character varying, "role_name" character varying NOT NULL, "assume_role_policy_document" jsonb NOT NULL, "description" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_d7cd1a92d0700424de6a0c595c9" PRIMARY KEY ("role_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "iam_user" ("arn" character varying, "user_name" character varying NOT NULL, "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "path" character varying, "user_id" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_3c2bdde602dd518cb7495880609" PRIMARY KEY ("user_name"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."access_key_status_enum" AS ENUM('Active', 'Inactive')`);
    await queryRunner.query(
      `CREATE TABLE "access_key" ("access_key_id" character varying NOT NULL, "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" "public"."access_key_status_enum", "user_user_name" character varying, CONSTRAINT "PK_ea22d1b924e556695a01c4b9ef2" PRIMARY KEY ("access_key_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_key" ADD CONSTRAINT "FK_d0f200d4c7585d131920165e9ff" FOREIGN KEY ("user_user_name") REFERENCES "iam_user"("user_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "access_key" DROP CONSTRAINT "FK_d0f200d4c7585d131920165e9ff"`);
    await queryRunner.query(`DROP TABLE "access_key"`);
    await queryRunner.query(`DROP TYPE "public"."access_key_status_enum"`);
    await queryRunner.query(`DROP TABLE "iam_user"`);
    await queryRunner.query(`DROP TABLE "iam_role"`);
  }
}
