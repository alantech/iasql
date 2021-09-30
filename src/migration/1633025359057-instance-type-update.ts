import {MigrationInterface, QueryRunner} from "typeorm";

export class instanceTypeUpdate1633025359057 implements MigrationInterface {
    name = 'instanceTypeUpdate1633025359057'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance_type" RENAME COLUMN "instance_type" TO "instance_type_value_id"`);
        await queryRunner.query(`ALTER TYPE "public"."instance_type_instance_type_enum" RENAME TO "instance_type_instance_type_value_id_enum"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" RENAME CONSTRAINT "UQ_f23043c39be7aa18881ab15c69a" TO "UQ_0194b635f62bbecb4295bd1491b"`);
        await queryRunner.query(`CREATE TABLE "instance_type_value" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_c044ed3e55560e10baf272f73fa" UNIQUE ("name"), CONSTRAINT "PK_3b0d5d2848fd758c86da5752587" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP CONSTRAINT "UQ_0194b635f62bbecb4295bd1491b"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP COLUMN "instance_type_value_id"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD "instance_type_value_id" integer`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD CONSTRAINT "UQ_0194b635f62bbecb4295bd1491b" UNIQUE ("instance_type_value_id")`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD CONSTRAINT "FK_0194b635f62bbecb4295bd1491b" FOREIGN KEY ("instance_type_value_id") REFERENCES "instance_type_value"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP CONSTRAINT "FK_0194b635f62bbecb4295bd1491b"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP CONSTRAINT "UQ_0194b635f62bbecb4295bd1491b"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" DROP COLUMN "instance_type_value_id"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD "instance_type_value_id" "public"."instance_type_instance_type_value_id_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" ADD CONSTRAINT "UQ_0194b635f62bbecb4295bd1491b" UNIQUE ("instance_type_value_id")`);
        await queryRunner.query(`DROP TABLE "instance_type_value"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" RENAME CONSTRAINT "UQ_0194b635f62bbecb4295bd1491b" TO "UQ_f23043c39be7aa18881ab15c69a"`);
        await queryRunner.query(`ALTER TYPE "public"."instance_type_instance_type_value_id_enum" RENAME TO "instance_type_instance_type_enum"`);
        await queryRunner.query(`ALTER TABLE "public"."instance_type" RENAME COLUMN "instance_type_value_id" TO "instance_type"`);
    }

}
