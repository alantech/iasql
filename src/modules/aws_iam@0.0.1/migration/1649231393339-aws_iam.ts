import {MigrationInterface, QueryRunner} from "typeorm";

export class awsIam1649231393339 implements MigrationInterface {
    name = 'awsIam1649231393339'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "role" ("arn" character varying, "role_name" character varying NOT NULL, "assume_role_policy_document" character varying NOT NULL, "description" character varying, "attached_policies_arns" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_4810bc474fe6394c6f58cb7c9e5" PRIMARY KEY ("role_name"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "role"`);
    }

}
