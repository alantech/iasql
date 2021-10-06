import {MigrationInterface, QueryRunner} from "typeorm";

export class regionUpdate1633532823116 implements MigrationInterface {
    name = 'regionUpdate1633532823116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "endpoint" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "opt_in_status" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "opt_in_status" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "endpoint" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."region" ALTER COLUMN "name" DROP NOT NULL`);
    }

}
