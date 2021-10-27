import {MigrationInterface, QueryRunner} from "typeorm";

export class ecs1634841944691 implements MigrationInterface {
    name = 'ecs1634841944691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."compatibility_name_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TABLE "compatibility" ("id" SERIAL NOT NULL, "name" "public"."compatibility_name_enum" NOT NULL, CONSTRAINT "UQ_794090c3afd5f43dba2c9fcd631" UNIQUE ("name"), CONSTRAINT "PK_254bde74086e8e3ef50174c3e60" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "env_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_87fd48bd952a768fcf07b9c9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316" UNIQUE ("name"), CONSTRAINT "PK_74656f796df3346fa6ec89fa727" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_network_mode_enum" AS ENUM('awsvpc', 'bridge', 'host', 'none')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "family_revision" character varying NOT NULL, "task_role_arn" character varying, "execution_role_arn" character varying, "network_mode" "public"."task_definition_network_mode_enum", "status" "public"."task_definition_status_enum", "cpu" character varying, "memory" character varying, CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_port_mappings_port_mapping" ("container_id" integer NOT NULL, "port_mapping_id" integer NOT NULL, CONSTRAINT "PK_86bba0922c06aa2d94b3c4b6bcb" PRIMARY KEY ("container_id", "port_mapping_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f24b4df268d81f6b0d7332955" ON "container_port_mappings_port_mapping" ("container_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d191532cf18e6888e27a8c13e4" ON "container_port_mappings_port_mapping" ("port_mapping_id") `);
        await queryRunner.query(`CREATE TABLE "container_environment_env_variable" ("container_id" integer NOT NULL, "env_variable_id" integer NOT NULL, CONSTRAINT "PK_b85f80a4400af9ce2478c06baca" PRIMARY KEY ("container_id", "env_variable_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_63d6af02003fa2878f4928aa39" ON "container_environment_env_variable" ("container_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0380f31a79b12d5840246dbfa" ON "container_environment_env_variable" ("env_variable_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_containers_container" ("task_definition_id" integer NOT NULL, "container_id" integer NOT NULL, CONSTRAINT "PK_0f4d88ef28c8dd5c832f6b59455" PRIMARY KEY ("task_definition_id", "container_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_150cf61597f886a39e6c4a60e3" ON "task_definition_containers_container" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8645e90b3981ca6e9e5e3c213b" ON "task_definition_containers_container" ("container_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_req_compatibilities_compatibility" ("task_definition_id" integer NOT NULL, "compatibility_id" integer NOT NULL, CONSTRAINT "PK_baf64abcea837eac4b5a95a63d9" PRIMARY KEY ("task_definition_id", "compatibility_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0909ccc9eddf3c92a777291256" ON "task_definition_req_compatibilities_compatibility" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f19b7360a189526c59b4387a95" ON "task_definition_req_compatibilities_compatibility" ("compatibility_id") `);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" ADD CONSTRAINT "FK_4f24b4df268d81f6b0d73329557" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" ADD CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d" FOREIGN KEY ("port_mapping_id") REFERENCES "port_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" ADD CONSTRAINT "FK_63d6af02003fa2878f4928aa39d" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" ADD CONSTRAINT "FK_d0380f31a79b12d5840246dbfa6" FOREIGN KEY ("env_variable_id") REFERENCES "env_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" ADD CONSTRAINT "FK_150cf61597f886a39e6c4a60e3a" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" ADD CONSTRAINT "FK_8645e90b3981ca6e9e5e3c213b2" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_0909ccc9eddf3c92a7772912562" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_f19b7360a189526c59b4387a953" FOREIGN KEY ("compatibility_id") REFERENCES "compatibility"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" DROP CONSTRAINT "FK_f19b7360a189526c59b4387a953"`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" DROP CONSTRAINT "FK_0909ccc9eddf3c92a7772912562"`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" DROP CONSTRAINT "FK_8645e90b3981ca6e9e5e3c213b2"`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" DROP CONSTRAINT "FK_150cf61597f886a39e6c4a60e3a"`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" DROP CONSTRAINT "FK_d0380f31a79b12d5840246dbfa6"`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" DROP CONSTRAINT "FK_63d6af02003fa2878f4928aa39d"`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" DROP CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d"`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" DROP CONSTRAINT "FK_4f24b4df268d81f6b0d73329557"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f19b7360a189526c59b4387a95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0909ccc9eddf3c92a777291256"`);
        await queryRunner.query(`DROP TABLE "task_definition_req_compatibilities_compatibility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8645e90b3981ca6e9e5e3c213b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_150cf61597f886a39e6c4a60e3"`);
        await queryRunner.query(`DROP TABLE "task_definition_containers_container"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0380f31a79b12d5840246dbfa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63d6af02003fa2878f4928aa39"`);
        await queryRunner.query(`DROP TABLE "container_environment_env_variable"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d191532cf18e6888e27a8c13e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f24b4df268d81f6b0d7332955"`);
        await queryRunner.query(`DROP TABLE "container_port_mappings_port_mapping"`);
        await queryRunner.query(`DROP TABLE "task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_network_mode_enum"`);
        await queryRunner.query(`DROP TABLE "container"`);
        await queryRunner.query(`DROP TABLE "port_mapping"`);
        await queryRunner.query(`DROP TYPE "public"."port_mapping_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "env_variable"`);
        await queryRunner.query(`DROP TABLE "compatibility"`);
        await queryRunner.query(`DROP TYPE "public"."compatibility_name_enum"`);
    }

}
