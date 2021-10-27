import {MigrationInterface, QueryRunner} from "typeorm";

export class engineVersionUpdate1634897777064 implements MigrationInterface {
    name = 'engineVersionUpdate1634897777064'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "engine_version" ADD "engine_version_key" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "engine_version" ADD CONSTRAINT "UQ_47fbf6564e1450fa0c527f7fb78" UNIQUE ("engine_version_key")`);
        await queryRunner.query(`ALTER TABLE "engine_version" DROP CONSTRAINT "UQ_ed96cab69ec37aed3821a4425c7"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "engine_version" ADD CONSTRAINT "UQ_ed96cab69ec37aed3821a4425c7" UNIQUE ("engine_version")`);
        await queryRunner.query(`ALTER TABLE "engine_version" DROP CONSTRAINT "UQ_47fbf6564e1450fa0c527f7fb78"`);
        await queryRunner.query(`ALTER TABLE "engine_version" DROP COLUMN "engine_version_key"`);
    }

}
