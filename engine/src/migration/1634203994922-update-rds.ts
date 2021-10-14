import {MigrationInterface, QueryRunner} from "typeorm";

export class updateRds1634203994922 implements MigrationInterface {
    name = 'updateRds1634203994922'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disk_info" RENAME COLUMN "type" TO "disk_type"`);
        await queryRunner.query(`ALTER TYPE "public"."disk_info_type_enum" RENAME TO "disk_info_disk_type_enum"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME COLUMN "type" TO "name"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME CONSTRAINT "UQ_8a722b68144f86254288cbf849b" TO "UQ_90b5b4a640e4111b86f0a514beb"`);
        await queryRunner.query(`CREATE TABLE "rds_db_security_groups_db_security_group" ("rds_id" integer NOT NULL, "db_security_group_id" integer NOT NULL, CONSTRAINT "PK_e00f8a3cffd5846cba584c68601" PRIMARY KEY ("rds_id", "db_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5f6b4512583474990282b90635" ON "rds_db_security_groups_db_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9edbd59b36dd67467f0f1fecfa" ON "rds_db_security_groups_db_security_group" ("db_security_group_id") `);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_security_group" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_d1ffa733808d137bc741f2fad22" PRIMARY KEY ("rds_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3f8d69062593d90e1d7a575463" ON "rds_vpc_security_groups_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8771bbe0783f3ff703bdb7e99" ON "rds_vpc_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds_db_security_groups_db_security_group" ADD CONSTRAINT "FK_5f6b4512583474990282b906352" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_db_security_groups_db_security_group" ADD CONSTRAINT "FK_9edbd59b36dd67467f0f1fecfa4" FOREIGN KEY ("db_security_group_id") REFERENCES "db_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_3f8d69062593d90e1d7a575463f" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_3f8d69062593d90e1d7a575463f"`);
        await queryRunner.query(`ALTER TABLE "rds_db_security_groups_db_security_group" DROP CONSTRAINT "FK_9edbd59b36dd67467f0f1fecfa4"`);
        await queryRunner.query(`ALTER TABLE "rds_db_security_groups_db_security_group" DROP CONSTRAINT "FK_5f6b4512583474990282b906352"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8771bbe0783f3ff703bdb7e99"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f8d69062593d90e1d7a575463"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9edbd59b36dd67467f0f1fecfa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f6b4512583474990282b90635"`);
        await queryRunner.query(`DROP TABLE "rds_db_security_groups_db_security_group"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME CONSTRAINT "UQ_90b5b4a640e4111b86f0a514beb" TO "UQ_8a722b68144f86254288cbf849b"`);
        await queryRunner.query(`ALTER TABLE "exportable_log_type" RENAME COLUMN "name" TO "type"`);
        await queryRunner.query(`ALTER TYPE "public"."disk_info_disk_type_enum" RENAME TO "disk_info_type_enum"`);
        await queryRunner.query(`ALTER TABLE "disk_info" RENAME COLUMN "disk_type" TO "type"`);
    }

}
