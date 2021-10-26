import {MigrationInterface, QueryRunner} from "typeorm";

export class updateSubnet1635275625307 implements MigrationInterface {
    name = 'updateSubnet1635275625307'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subnet" DROP COLUMN "cidr_block"`);
        await queryRunner.query(`ALTER TABLE "subnet" ADD "cidr_block" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subnet" DROP COLUMN "cidr_block"`);
        await queryRunner.query(`ALTER TABLE "subnet" ADD "cidr_block" boolean`);
    }

}
