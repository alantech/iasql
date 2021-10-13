import {MigrationInterface, QueryRunner} from "typeorm";

export class updateRds1634150023495 implements MigrationInterface {
    name = 'updateRds1634150023495'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disk_info" RENAME COLUMN "type" TO "disk_type"`);
        await queryRunner.query(`ALTER TYPE "public"."disk_info_type_enum" RENAME TO "disk_info_disk_type_enum"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME COLUMN "type" TO "name"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME CONSTRAINT "UQ_8a722b68144f86254288cbf849b" TO "UQ_90b5b4a640e4111b86f0a514beb"`);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_security_group" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_d1ffa733808d137bc741f2fad22" PRIMARY KEY ("rds_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3f8d69062593d90e1d7a575463" ON "rds_vpc_security_groups_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8771bbe0783f3ff703bdb7e99" ON "rds_vpc_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_3f8d69062593d90e1d7a575463f" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_3f8d69062593d90e1d7a575463f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8771bbe0783f3ff703bdb7e99"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f8d69062593d90e1d7a575463"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_security_group"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME CONSTRAINT "UQ_90b5b4a640e4111b86f0a514beb" TO "UQ_8a722b68144f86254288cbf849b"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME COLUMN "name" TO "type"`);
        await queryRunner.query(`ALTER TYPE "public"."disk_info_disk_type_enum" RENAME TO "disk_info_type_enum"`);
        await queryRunner.query(`ALTER TABLE "disk_info" RENAME COLUMN "disk_type" TO "type"`);
    }

}
