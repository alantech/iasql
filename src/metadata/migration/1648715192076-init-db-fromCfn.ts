import {MigrationInterface, QueryRunner} from "typeorm";

export class initDbFromCfn1648715192076 implements MigrationInterface {
    name = 'initDbFromCfn1648715192076'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" ADD "from_cloudformation" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "from_cloudformation"`);
    }

}
