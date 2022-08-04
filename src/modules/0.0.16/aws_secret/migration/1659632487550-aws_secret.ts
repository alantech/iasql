import {MigrationInterface, QueryRunner} from "typeorm";

export class awsSecret1659632487550 implements MigrationInterface {
    name = 'awsSecret1659632487550'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "secret" ("name" character varying NOT NULL, "description" character varying, "value" character varying, CONSTRAINT "PK_f05861f3e072021bda08543eb4c" PRIMARY KEY ("name"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "secret"`);
    }

}
