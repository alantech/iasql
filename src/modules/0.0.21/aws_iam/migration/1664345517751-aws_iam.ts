import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsIam1664345517751 implements MigrationInterface {
  name = 'awsIam1664345517751';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role" ("arn" character varying, "role_name" character varying NOT NULL, "assume_role_policy_document" jsonb NOT NULL, "description" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_4810bc474fe6394c6f58cb7c9e5" PRIMARY KEY ("role_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "iam_user" ("arn" character varying, "user_name" character varying NOT NULL, "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "path" character varying, "user_id" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_3c2bdde602dd518cb7495880609" PRIMARY KEY ("user_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "iam_user"`);
    await queryRunner.query(`DROP TABLE "role"`);
  }
}
