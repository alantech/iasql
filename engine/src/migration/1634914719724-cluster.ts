import {MigrationInterface, QueryRunner} from "typeorm";

export class cluster1634914719724 implements MigrationInterface {
    name = 'cluster1634914719724'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, CONSTRAINT "UQ_2baf81de2d47a4721c82b260d63" UNIQUE ("name"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "cluster"`);
    }

}
