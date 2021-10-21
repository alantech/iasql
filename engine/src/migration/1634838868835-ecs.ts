import {MigrationInterface, QueryRunner} from "typeorm";

export class ecs1634838868835 implements MigrationInterface {
    name = 'ecs1634838868835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."compatibility_name_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TABLE "compatibility" ("id" SERIAL NOT NULL, "name" "public"."compatibility_name_enum" NOT NULL, CONSTRAINT "UQ_794090c3afd5f43dba2c9fcd631" UNIQUE ("name"), CONSTRAINT "PK_254bde74086e8e3ef50174c3e60" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "environmet_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_0c6e9879ee541ab6183c962219e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_6024983b2ea3aca45213b51e91f" UNIQUE ("name"), CONSTRAINT "PK_79458e199ec6b2264a0735fd99e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_network_mode_enum" AS ENUM('awsvpc', 'bridge', 'host', 'none')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "family_revision" character varying NOT NULL, "task_role_arn" character varying, "execution_role_arn" character varying, "network_mode" "public"."task_definition_network_mode_enum", "status" "public"."task_definition_status_enum", "cpu" character varying, "memory" character varying, CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_definition_port_mappings_port_mapping" ("container_definition_id" integer NOT NULL, "port_mapping_id" integer NOT NULL, CONSTRAINT "PK_cd68e8ce9f3e67cc4c5d7594261" PRIMARY KEY ("container_definition_id", "port_mapping_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c9e7dd2ccbf3da95dc83aade5" ON "container_definition_port_mappings_port_mapping" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cf0edf6692e95228082e81bd11" ON "container_definition_port_mappings_port_mapping" ("port_mapping_id") `);
        await queryRunner.query(`CREATE TABLE "container_definition_environment_environmet_variable" ("container_definition_id" integer NOT NULL, "environmet_variable_id" integer NOT NULL, CONSTRAINT "PK_e21650e2d954241a2ebc11d37d9" PRIMARY KEY ("container_definition_id", "environmet_variable_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_33203c63dfc4cc96a36fb205a4" ON "container_definition_environment_environmet_variable" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6386f945aafdcab1844bbaeae9" ON "container_definition_environment_environmet_variable" ("environmet_variable_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_container_definitions_container_definition" ("task_definition_id" integer NOT NULL, "container_definition_id" integer NOT NULL, CONSTRAINT "PK_a6f8d1f15793a0d7b9ac028d9c2" PRIMARY KEY ("task_definition_id", "container_definition_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f093b91935194f62cbc0500ccb" ON "task_definition_container_definitions_container_definition" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc4a5b886a04af9fb2c7ff2b04" ON "task_definition_container_definitions_container_definition" ("container_definition_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_requires_compatibilities_compatibility" ("task_definition_id" integer NOT NULL, "compatibility_id" integer NOT NULL, CONSTRAINT "PK_3079c7ce72deae311afa031f1d8" PRIMARY KEY ("task_definition_id", "compatibility_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9ab2c0e39abc61805360ad38b4" ON "task_definition_requires_compatibilities_compatibility" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ccc94549a62100dc9e755de39c" ON "task_definition_requires_compatibilities_compatibility" ("compatibility_id") `);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_1c9e7dd2ccbf3da95dc83aade5d" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_cf0edf6692e95228082e81bd11b" FOREIGN KEY ("port_mapping_id") REFERENCES "port_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" ADD CONSTRAINT "FK_33203c63dfc4cc96a36fb205a45" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" ADD CONSTRAINT "FK_6386f945aafdcab1844bbaeae96" FOREIGN KEY ("environmet_variable_id") REFERENCES "environmet_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_container_definitions_container_definition" ADD CONSTRAINT "FK_f093b91935194f62cbc0500ccb6" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_container_definitions_container_definition" ADD CONSTRAINT "FK_cc4a5b886a04af9fb2c7ff2b042" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_requires_compatibilities_compatibility" ADD CONSTRAINT "FK_9ab2c0e39abc61805360ad38b48" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_requires_compatibilities_compatibility" ADD CONSTRAINT "FK_ccc94549a62100dc9e755de39c9" FOREIGN KEY ("compatibility_id") REFERENCES "compatibility"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition_requires_compatibilities_compatibility" DROP CONSTRAINT "FK_ccc94549a62100dc9e755de39c9"`);
        await queryRunner.query(`ALTER TABLE "task_definition_requires_compatibilities_compatibility" DROP CONSTRAINT "FK_9ab2c0e39abc61805360ad38b48"`);
        await queryRunner.query(`ALTER TABLE "task_definition_container_definitions_container_definition" DROP CONSTRAINT "FK_cc4a5b886a04af9fb2c7ff2b042"`);
        await queryRunner.query(`ALTER TABLE "task_definition_container_definitions_container_definition" DROP CONSTRAINT "FK_f093b91935194f62cbc0500ccb6"`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" DROP CONSTRAINT "FK_6386f945aafdcab1844bbaeae96"`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" DROP CONSTRAINT "FK_33203c63dfc4cc96a36fb205a45"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_cf0edf6692e95228082e81bd11b"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_1c9e7dd2ccbf3da95dc83aade5d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccc94549a62100dc9e755de39c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ab2c0e39abc61805360ad38b4"`);
        await queryRunner.query(`DROP TABLE "task_definition_requires_compatibilities_compatibility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc4a5b886a04af9fb2c7ff2b04"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f093b91935194f62cbc0500ccb"`);
        await queryRunner.query(`DROP TABLE "task_definition_container_definitions_container_definition"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6386f945aafdcab1844bbaeae9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_33203c63dfc4cc96a36fb205a4"`);
        await queryRunner.query(`DROP TABLE "container_definition_environment_environmet_variable"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf0edf6692e95228082e81bd11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c9e7dd2ccbf3da95dc83aade5"`);
        await queryRunner.query(`DROP TABLE "container_definition_port_mappings_port_mapping"`);
        await queryRunner.query(`DROP TABLE "task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_network_mode_enum"`);
        await queryRunner.query(`DROP TABLE "container_definition"`);
        await queryRunner.query(`DROP TABLE "port_mapping"`);
        await queryRunner.query(`DROP TYPE "public"."port_mapping_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "environmet_variable"`);
        await queryRunner.query(`DROP TABLE "compatibility"`);
        await queryRunner.query(`DROP TYPE "public"."compatibility_name_enum"`);
    }

}
