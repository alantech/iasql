import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTaskDef1635865344947 implements MigrationInterface {
    name = 'updateTaskDef1635865344947'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" ADD CONSTRAINT "UQ_90df3d6ac87e0ff5aa69a9ea13d" UNIQUE ("family_revision")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "UQ_90df3d6ac87e0ff5aa69a9ea13d"`);
    }

}
