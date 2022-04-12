import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1649732068854 implements MigrationInterface {
    name = 'awsRds1649732068854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "availability_zone" character varying NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_security_groups" ("rds_id" integer NOT NULL, "security_group_group_name" character varying NOT NULL, CONSTRAINT "PK_79c20b2b98551bc82d05b0861d2" PRIMARY KEY ("rds_id", "security_group_group_name"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1927b280e2770235e52a9e0fb" ON "rds_security_groups" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c838c63f5bf7a710103ddb2ce1" ON "rds_security_groups" ("security_group_group_name") `);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_c838c63f5bf7a710103ddb2ce1f" FOREIGN KEY ("security_group_group_name") REFERENCES "security_group"("group_name") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_c838c63f5bf7a710103ddb2ce1f"`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c838c63f5bf7a710103ddb2ce1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1927b280e2770235e52a9e0fb"`);
        await queryRunner.query(`DROP TABLE "rds_security_groups"`);
        await queryRunner.query(`DROP TABLE "rds"`);
    }

}
