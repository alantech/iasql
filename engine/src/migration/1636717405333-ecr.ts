import {MigrationInterface, QueryRunner} from "typeorm";

export class ecr1636717405333 implements MigrationInterface {
    name = 'ecr1636717405333'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repository" ADD CONSTRAINT "UQ_8845a838de662324047b4a9bdd6" UNIQUE ("repository_name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repository" DROP CONSTRAINT "UQ_8845a838de662324047b4a9bdd6"`);
    }

}
