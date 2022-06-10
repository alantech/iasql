import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1654853898677 implements MigrationInterface {
    name = 'awsRds1654853898677'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "parameter_group" ("name" character varying NOT NULL, "arn" character varying, "family" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "UQ_cd5d35716aae42c8f6acb7dc989" UNIQUE ("arn"), CONSTRAINT "PK_d1f1ec0894042fdb4c40575feff" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "availability_zone" character varying NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', "parameter_group_name" character varying, CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "parameter" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying, "description" character varying, "source" character varying, "apply_type" character varying, "data_type" character varying, "is_modifiable" boolean NOT NULL DEFAULT false, "allowed_values" character varying, "apply_method" character varying, "minimum_engine_version" character varying, "parameter_group_name" character varying, CONSTRAINT "PK_cc5c047040f9c69f0e0d6a844a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_security_groups" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_a0b5fa8fc927a6d22d5e2125e86" PRIMARY KEY ("rds_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1927b280e2770235e52a9e0fb" ON "rds_security_groups" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4080f9f7f3fa99ac9d68dd910" ON "rds_security_groups" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds" ADD CONSTRAINT "FK_13a712475f3f2ddad6d8fd5d3f1" FOREIGN KEY ("parameter_group_name") REFERENCES "parameter_group"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parameter" ADD CONSTRAINT "FK_996436925a6b06a81ad07b722b6" FOREIGN KEY ("parameter_group_name") REFERENCES "parameter_group"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a"`);
        await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1"`);
        await queryRunner.query(`ALTER TABLE "parameter" DROP CONSTRAINT "FK_996436925a6b06a81ad07b722b6"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_13a712475f3f2ddad6d8fd5d3f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4080f9f7f3fa99ac9d68dd910"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1927b280e2770235e52a9e0fb"`);
        await queryRunner.query(`DROP TABLE "rds_security_groups"`);
        await queryRunner.query(`DROP TABLE "parameter"`);
        await queryRunner.query(`DROP TABLE "rds"`);
        await queryRunner.query(`DROP TABLE "parameter_group"`);
    }

}
