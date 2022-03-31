import {MigrationInterface, QueryRunner} from "typeorm";

export class initDbStatus1648715085646 implements MigrationInterface {
    name = 'initDbStatus1648715085646'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" ADD "is_ready" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "is_ready"`);
    }

}
