import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1647368758676 implements MigrationInterface {
    name = 'awsRds1647368758676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "availability_zone" character varying NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_security_groups" ("rds_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_d9750effd57fff2c6881545ee5f" PRIMARY KEY ("rds_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1927b280e2770235e52a9e0fb" ON "rds_security_groups" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8848443d699aa18a947d0df423" ON "rds_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_8848443d699aa18a947d0df423e" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_8848443d699aa18a947d0df423e"`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8848443d699aa18a947d0df423"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1927b280e2770235e52a9e0fb"`);
        await queryRunner.query(`DROP TABLE "rds_security_groups"`);
        await queryRunner.query(`DROP TABLE "rds"`);
    }

}
