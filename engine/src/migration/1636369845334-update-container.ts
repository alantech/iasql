import {MigrationInterface, QueryRunner} from "typeorm";

export class updateContainer1636369845334 implements MigrationInterface {
    name = 'updateContainer1636369845334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" ADD "container_id" integer`);
        await queryRunner.query(`ALTER TABLE "task_definition" ADD CONSTRAINT "FK_99b92a278f62ec8631b3a3af9a1" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_99b92a278f62ec8631b3a3af9a1"`);
        await queryRunner.query(`ALTER TABLE "task_definition" DROP COLUMN "container_id"`);
    }

}
