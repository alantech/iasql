import { MigrationInterface, QueryRunner } from 'typeorm';

import * as sql from '../sql';

export class awsEcsFargate1658248709690 implements MigrationInterface {
  name = 'awsEcsFargate1658248709690';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cluster" ("cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "PK_45ffb6495d51fdc55df46102ce7" PRIMARY KEY ("cluster_name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."container_definition_protocol_enum" AS ENUM('tcp', 'udp')`,
    );
    await queryRunner.query(
      `CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying, "tag" character varying, "digest" character varying, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "host_port" integer, "container_port" integer, "protocol" "public"."container_definition_protocol_enum", "env_variables" text, "task_definition_id" integer, "repository_name" character varying, "public_repository_name" character varying, "log_group_name" character varying, CONSTRAINT "CHK_7c71371f8b24ff4868a039a7a9" CHECK (("tag" is null and "digest" is null) or ("tag" is not null and "digest" is null) or ("tag" is null and "digest" is not null)), CONSTRAINT "CHK_4de2350c230969507b1009bfbc" CHECK (("image" is null and ("repository_name" is not null or "public_repository_name" is not null)) or "image" is not null), CONSTRAINT "PK_79458e199ec6b2264a0735fd99e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."service_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "service" ("name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "subnets" text array NOT NULL, "assign_public_ip" "public"."service_assign_public_ip_enum" NOT NULL DEFAULT 'DISABLED', "force_new_deployment" boolean NOT NULL DEFAULT false, "cluster_name" character varying, "task_definition_id" integer, "target_group_name" character varying, CONSTRAINT "PK_7806a14d42c3244064b4a1706ca" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('vCPU0.25-0.5GB', 'vCPU0.25-1GB', 'vCPU0.25-2GB', 'vCPU0.5-1GB', 'vCPU0.5-2GB', 'vCPU0.5-3GB', 'vCPU0.5-4GB', 'vCPU1-2GB', 'vCPU1-3GB', 'vCPU1-4GB', 'vCPU1-5GB', 'vCPU1-6GB', 'vCPU1-7GB', 'vCPU1-8GB', 'vCPU2-4GB', 'vCPU2-5GB', 'vCPU2-6GB', 'vCPU2-7GB', 'vCPU2-8GB', 'vCPU2-9GB', 'vCPU2-10GB', 'vCPU2-11GB', 'vCPU2-12GB', 'vCPU2-13GB', 'vCPU2-14GB', 'vCPU2-15GB', 'vCPU2-16GB', 'vCPU4-8GB', 'vCPU4-9GB', 'vCPU4-10GB', 'vCPU4-11GB', 'vCPU4-12GB', 'vCPU4-13GB', 'vCPU4-14GB', 'vCPU4-15GB', 'vCPU4-16GB', 'vCPU4-17GB', 'vCPU4-18GB', 'vCPU4-19GB', 'vCPU4-20GB', 'vCPU4-21GB', 'vCPU4-22GB', 'vCPU4-23GB', 'vCPU4-24GB', 'vCPU4-25GB', 'vCPU4-26GB', 'vCPU4-27GB', 'vCPU4-28GB', 'vCPU4-29GB', 'vCPU4-30GB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "status" "public"."task_definition_status_enum", "cpu_memory" "public"."task_definition_cpu_memory_enum", "task_role_name" character varying, "execution_role_name" character varying, CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_security_groups" ("service_name" character varying NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_f9e4b5a414490b308112b17bdca" PRIMARY KEY ("service_name", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77d1612919c51ab18afb1be95a" ON "service_security_groups" ("service_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0407238e46717099da0443dff7" ON "service_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_95900c2acc0286c7976d9b729b2" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_5b8e931f2150a5a570a809a08e8" FOREIGN KEY ("repository_name") REFERENCES "repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_223740ffb1779c07fbad5853e28" FOREIGN KEY ("public_repository_name") REFERENCES "public_repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_c5fb01e4d577508d84e3c77a100" FOREIGN KEY ("log_group_name") REFERENCES "log_group"("log_group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_5a4fe987d7ad1cae04473db3db8" FOREIGN KEY ("cluster_name") REFERENCES "cluster"("cluster_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_3ea3121991d342446c45336ad2e" FOREIGN KEY ("target_group_name") REFERENCES "target_group"("target_group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_definition" ADD CONSTRAINT "FK_7ea89f0f48f85fb6182e98603a6" FOREIGN KEY ("task_role_name") REFERENCES "role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_definition" ADD CONSTRAINT "FK_dcf86a08d8805551fe92f7cd8f1" FOREIGN KEY ("execution_role_name") REFERENCES "role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" ADD CONSTRAINT "FK_77d1612919c51ab18afb1be95a2" FOREIGN KEY ("service_name") REFERENCES "service"("name") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" ADD CONSTRAINT "FK_0407238e46717099da0443dff75" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(sql.createCustomConstraints);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(sql.dropCustomConstraints);
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" DROP CONSTRAINT "FK_0407238e46717099da0443dff75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" DROP CONSTRAINT "FK_77d1612919c51ab18afb1be95a2"`,
    );
    await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_dcf86a08d8805551fe92f7cd8f1"`);
    await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_7ea89f0f48f85fb6182e98603a6"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_3ea3121991d342446c45336ad2e"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_5a4fe987d7ad1cae04473db3db8"`);
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_c5fb01e4d577508d84e3c77a100"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_223740ffb1779c07fbad5853e28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_5b8e931f2150a5a570a809a08e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_95900c2acc0286c7976d9b729b2"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_0407238e46717099da0443dff7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77d1612919c51ab18afb1be95a"`);
    await queryRunner.query(`DROP TABLE "service_security_groups"`);
    await queryRunner.query(`DROP TABLE "task_definition"`);
    await queryRunner.query(`DROP TYPE "public"."task_definition_cpu_memory_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
    await queryRunner.query(`DROP TABLE "service"`);
    await queryRunner.query(`DROP TYPE "public"."service_assign_public_ip_enum"`);
    await queryRunner.query(`DROP TABLE "container_definition"`);
    await queryRunner.query(`DROP TYPE "public"."container_definition_protocol_enum"`);
    await queryRunner.query(`DROP TABLE "cluster"`);
  }
}
