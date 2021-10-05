import {MigrationInterface, QueryRunner} from "typeorm";

export class instanceUpdate1633425962883 implements MigrationInterface {
    name = 'instanceUpdate1633425962883'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance" DROP CONSTRAINT "FK_629601e74b48d0feb492656a594"`);
        await queryRunner.query(`ALTER TABLE "public"."instance" DROP COLUMN "region_id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance" ADD "region_id" integer`);
        await queryRunner.query(`ALTER TABLE "public"."instance" ADD CONSTRAINT "FK_629601e74b48d0feb492656a594" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
