import {MigrationInterface, QueryRunner} from "typeorm";

export class rds1633616574508 implements MigrationInterface {
    name = 'rds1633616574508'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "dbi_resource_id" character varying, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "auto_minor_version_upgrade" boolean, "backup_retention_period" integer DEFAULT '1', "character_set_name" character varying, "copy_tags_to_snapshot" boolean DEFAULT false, "db_cluster_identifier" character varying, "db_instance_class" character varying NOT NULL, "db_name" character varying, "db_parameter_groups" character varying, "db_security_groups" character varying, "deletion_protection" boolean DEFAULT false, "domain_memberships" character varying, "enable_cloudwatch_logs_exports" character varying, "enable_customer_owned_ip" boolean, "enable_iam_database_authentication" boolean DEFAULT false, "enable_performance_insights" boolean, "engine" character varying NOT NULL, "engine_version" character varying, "iops" integer, "kms_key_id" character varying, "license_model" character varying, "master_user_password" character varying, "master_username" character varying, "max_allocated_storage" integer, "monitoring_interval" integer NOT NULL DEFAULT '0', "monitoring_role_arn" character varying, "multi_az" boolean, "nchar_character_set_name" character varying, "option_group_name" character varying, "performance_insights_kms_key_id" character varying, "performance_insights_retention_period" integer, "port" integer, "preferred_backup_window" character varying, "preferred_maintenance_window" character varying, "processor_features" character varying, "promotion_tier" integer DEFAULT '1', "publicly_accessible" boolean, "storage_encrypted" boolean, "storage_type" character varying, "tde_credential_arn" character varying, "tde_credential_password" character varying, "timezone" character varying, "availability_zone_id" integer, CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_tags_tag" ("rds_id" integer NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_064878365c3757e6fb2baee6b02" PRIMARY KEY ("rds_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2df06d9732e153c117aa5e22d6" ON "rds_tags_tag" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c8e70858e8f1e5d846414914e" ON "rds_tags_tag" ("tag_id") `);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_security_group" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_d1ffa733808d137bc741f2fad22" PRIMARY KEY ("rds_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3f8d69062593d90e1d7a575463" ON "rds_vpc_security_groups_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8771bbe0783f3ff703bdb7e99" ON "rds_vpc_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv4addresses_per_interface"`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv6addresses_per_interface"`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv6supported"`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv4_addresses_per_interface" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv6_addresses_per_interface" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv6_supported" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "endpoint" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "opt_in_status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "rds" ADD CONSTRAINT "FK_88d7baba1011b1d780d4087e401" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rds_tags_tag" ADD CONSTRAINT "FK_2df06d9732e153c117aa5e22d63" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_tags_tag" ADD CONSTRAINT "FK_8c8e70858e8f1e5d846414914ef" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_3f8d69062593d90e1d7a575463f" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" ADD CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_d8771bbe0783f3ff703bdb7e993"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_security_group" DROP CONSTRAINT "FK_3f8d69062593d90e1d7a575463f"`);
        await queryRunner.query(`ALTER TABLE "rds_tags_tag" DROP CONSTRAINT "FK_8c8e70858e8f1e5d846414914ef"`);
        await queryRunner.query(`ALTER TABLE "rds_tags_tag" DROP CONSTRAINT "FK_2df06d9732e153c117aa5e22d63"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_88d7baba1011b1d780d4087e401"`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "opt_in_status" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "endpoint" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "region" ALTER COLUMN "name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv6_supported"`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv6_addresses_per_interface"`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP COLUMN "ipv4_addresses_per_interface"`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv6supported" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv6addresses_per_interface" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD "ipv4addresses_per_interface" integer NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8771bbe0783f3ff703bdb7e99"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f8d69062593d90e1d7a575463"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c8e70858e8f1e5d846414914e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2df06d9732e153c117aa5e22d6"`);
        await queryRunner.query(`DROP TABLE "rds_tags_tag"`);
        await queryRunner.query(`DROP TABLE "rds"`);
    }

}
