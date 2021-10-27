import {MigrationInterface, QueryRunner} from "typeorm";

export class containerUpdate1634893802014 implements MigrationInterface {
    name = 'containerUpdate1634893802014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" ADD "cpu" integer`);
        await queryRunner.query(`ALTER TABLE "container" ADD "memory" integer`);
        await queryRunner.query(`ALTER TABLE "container" ADD "memory_reservation" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "memory_reservation"`);
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "memory"`);
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "cpu"`);
    }

}
