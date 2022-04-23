import {MigrationInterface, QueryRunner} from "typeorm";

export class dropRegionFromMetaDb1650685649618 implements MigrationInterface {
    name = 'dropRegionFromMetaDb1650685649618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" DROP COLUMN "region"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "iasql_database" ADD "region" character varying NOT NULL`);
    }

}
