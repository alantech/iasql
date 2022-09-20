import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsIam1663659052853 implements MigrationInterface {
  name = 'awsIam1663659052853';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role" ("arn" character varying, "role_name" character varying NOT NULL, "assume_role_policy_document" jsonb NOT NULL, "description" character varying, "attached_policies_arns" text array, CONSTRAINT "PK_4810bc474fe6394c6f58cb7c9e5" PRIMARY KEY ("role_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("arn" character varying, "user_name" character varying NOT NULL, "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "path" character varying, "user_id" character varying, CONSTRAINT "PK_d34106f8ec1ebaf66f4f8609dd6" PRIMARY KEY ("user_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "role"`);
  }
}
