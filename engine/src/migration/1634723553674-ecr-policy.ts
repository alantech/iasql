import {MigrationInterface, QueryRunner} from "typeorm";

export class ecrPolicy1634723553674 implements MigrationInterface {
    name = 'ecrPolicy1634723553674'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."repository_policy" ADD "repository_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."repository_policy" ADD CONSTRAINT "UQ_45a97f8e1308371a0b2874ee1c4" UNIQUE ("repository_name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."repository_policy" DROP CONSTRAINT "UQ_45a97f8e1308371a0b2874ee1c4"`);
        await queryRunner.query(`ALTER TABLE "public"."repository_policy" DROP COLUMN "repository_name"`);
    }

}
