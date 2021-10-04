import {MigrationInterface, QueryRunner} from "typeorm";

export class availabilityZoneUpdate1633113824213 implements MigrationInterface {
    name = 'availabilityZoneUpdate1633113824213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."availability_zone" DROP COLUMN "zone_id"`);
        await queryRunner.query(`ALTER TABLE "public"."availability_zone" ADD "zone_id" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."availability_zone" DROP COLUMN "zone_id"`);
        await queryRunner.query(`ALTER TABLE "public"."availability_zone" ADD "zone_id" integer NOT NULL`);
    }

}
