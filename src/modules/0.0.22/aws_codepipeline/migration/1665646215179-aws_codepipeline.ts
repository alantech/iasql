import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCodepipeline1665646215179 implements MigrationInterface {
    name = 'awsCodepipeline1665646215179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pipeline_declaration" ("name" character varying NOT NULL, "artifact_store" json NOT NULL, "stages" json, "service_role_name" character varying, CONSTRAINT "PK_f69c1c2a340911b6ea0e2508741" PRIMARY KEY ("name"))`);
        await queryRunner.query(`ALTER TABLE "pipeline_declaration" ADD CONSTRAINT "FK_d791d1a394429e36cfe2a1cf851" FOREIGN KEY ("service_role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pipeline_declaration" DROP CONSTRAINT "FK_d791d1a394429e36cfe2a1cf851"`);
        await queryRunner.query(`DROP TABLE "pipeline_declaration"`);
    }

}
