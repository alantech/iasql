import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTaskDef1636375647767 implements MigrationInterface {
    name = 'updateTaskDef1636375647767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "UQ_90df3d6ac87e0ff5aa69a9ea13d"`);
        await queryRunner.query(`ALTER TABLE "task_definition" DROP COLUMN "family_revision"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" ADD "family_revision" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "task_definition" ADD CONSTRAINT "UQ_90df3d6ac87e0ff5aa69a9ea13d" UNIQUE ("family_revision")`);
    }

}
