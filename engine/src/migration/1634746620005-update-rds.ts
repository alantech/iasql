import {MigrationInterface, QueryRunner} from "typeorm";

export class updateRds1634746620005 implements MigrationInterface {
    name = 'updateRds1634746620005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orderable_db_instance_option" ADD "composite_key" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orderable_db_instance_option" DROP COLUMN "composite_key"`);
    }

}
