import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAcmImport1651846686656 implements MigrationInterface {
    name = 'awsAcmImport1651846686656'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "certificate_import" ("id" SERIAL NOT NULL, "body" character varying NOT NULL, "private_key" character varying NOT NULL, "chain" character varying, CONSTRAINT "PK_8cbbdc4878246d11a36a5639a04" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "certificate_import"`);
    }

}
