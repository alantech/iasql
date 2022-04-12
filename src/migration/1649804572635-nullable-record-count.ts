import {MigrationInterface, QueryRunner} from "typeorm";

export class nullableRecordCount1649804572635 implements MigrationInterface {
    name = 'nullableRecordCount1649804572635'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" ALTER COLUMN "record_count" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" ALTER COLUMN "record_count" SET NOT NULL`);
    }

}
