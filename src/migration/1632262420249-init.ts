import {MigrationInterface, QueryRunner} from "typeorm";

export class init1632262420249 implements MigrationInterface {
    name = 'init1632262420249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "region" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "endpoint" character varying NOT NULL, "optInStatus" character varying NOT NULL, CONSTRAINT "PK_5f48ffc3af96bc486f5f3f3a6da" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "region"`);
    }

}
