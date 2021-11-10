import {MigrationInterface, QueryRunner} from "typeorm";

export class updateContainer1636368838240 implements MigrationInterface {
    name = 'updateContainer1636368838240'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316" UNIQUE ("name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316"`);
    }

}
