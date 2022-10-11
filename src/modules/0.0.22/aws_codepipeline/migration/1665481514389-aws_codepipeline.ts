import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCodepipeline1665481514389 implements MigrationInterface {
    name = 'awsCodepipeline1665481514389'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pipeline_declaration" ("name" character varying NOT NULL, "artifact_store" json NOT NULL, "role_arn" character varying, "stages" json, CONSTRAINT "PK_f69c1c2a340911b6ea0e2508741" PRIMARY KEY ("name"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "pipeline_declaration"`);
    }

}
