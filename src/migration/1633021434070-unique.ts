import {MigrationInterface, QueryRunner} from "typeorm";

export class unique1633021434070 implements MigrationInterface {
    name = 'unique1633021434070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD CONSTRAINT "UQ_f23043c39be7aa18881ab15c69a" UNIQUE ("instance_type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP CONSTRAINT "UQ_f23043c39be7aa18881ab15c69a"`);
    }

}
