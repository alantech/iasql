import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsIam1664438247839 implements MigrationInterface {
  name = 'awsIam1664438247839';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "iam_role" ("arn" character varying, "role_name" character varying NOT NULL, "assume_role_policy_document" jsonb NOT NULL, "description" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_d7cd1a92d0700424de6a0c595c9" PRIMARY KEY ("role_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "iam_user" ("arn" character varying, "user_name" character varying NOT NULL, "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "path" character varying, "user_id" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_3c2bdde602dd518cb7495880609" PRIMARY KEY ("user_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "iam_user"`);
    await queryRunner.query(`DROP TABLE "iam_role"`);
  }
}
