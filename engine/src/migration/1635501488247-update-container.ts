import {MigrationInterface, QueryRunner} from "typeorm";

export class updateContainer1635501488247 implements MigrationInterface {
    name = 'updateContainer1635501488247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316" UNIQUE ("name")`);
    }

}
