import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcsFargate1647370228895 implements MigrationInterface {
    name = 'awsEcsFargate1647370228895'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_45ffb6495d51fdc55df46102ce7" UNIQUE ("cluster_name"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."service_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "subnets" text array NOT NULL, "assign_public_ip" "public"."service_assign_public_ip_enum" NOT NULL DEFAULT 'DISABLED', "force_new_deployment" boolean NOT NULL DEFAULT false, "cluster_id" integer, "task_definition_id" integer, "target_group_id" integer, CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE ("name"), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('0.25vCPU-0.5GB', '0.25vCPU-1GB', '0.25vCPU-2GB', '0.5vCPU-1GB', '0.5vCPU-2GB', '0.5vCPU-3GB', '0.5vCPU-4GB', '1vCPU-2GB', '1vCPU-3GB', '1vCPU-4GB', '1vCPU-5GB', '1vCPU-6GB', '1vCPU-7GB', '1vCPU-8GB', '2vCPU-4GB', '2vCPU-5GB', '2vCPU-6GB', '2vCPU-7GB', '2vCPU-8GB', '2vCPU-9GB', '2vCPU-10GB', '2vCPU-11GB', '2vCPU-12GB', '2vCPU-13GB', '2vCPU-14GB', '2vCPU-15GB', '2vCPU-16GB', '4vCPU-8GB', '4vCPU-9GB', '4vCPU-10GB', '4vCPU-11GB', '4vCPU-12GB', '4vCPU-13GB', '4vCPU-14GB', '4vCPU-15GB', '4vCPU-16GB', '4vCPU-17GB', '4vCPU-18GB', '4vCPU-19GB', '4vCPU-20GB', '4vCPU-21GB', '4vCPU-22GB', '4vCPU-23GB', '4vCPU-24GB', '4vCPU-25GB', '4vCPU-26GB', '4vCPU-27GB', '4vCPU-28GB', '4vCPU-29GB', '4vCPU-30GB')`);
        await queryRunner.query(`CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "task_role_arn" character varying, "execution_role_arn" character varying, "status" "public"."task_definition_status_enum", "cpu_memory" "public"."task_definition_cpu_memory_enum", CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."container_definition_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying, "tag" character varying, "digest" character varying, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "host_port" integer, "container_port" integer, "protocol" "public"."container_definition_protocol_enum", "env_variables" text, "task_definition_id" integer, "repository_id" integer, "public_repository_id" integer, "log_group_id" integer, CONSTRAINT "CHK_7c71371f8b24ff4868a039a7a9" CHECK (("tag" is null and "digest" is null) or ("tag" is not null and "digest" is null) or ("tag" is null and "digest" is not null)), CONSTRAINT "CHK_3b7a4f463a5514630fff9750bd" CHECK (("image" is null and ("repository_id" is not null or "public_repository_id" is not null)) or "image" is not null), CONSTRAINT "PK_79458e199ec6b2264a0735fd99e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_service_security_groups" ("service_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_171a297c6b33be30c48c28a8d79" PRIMARY KEY ("service_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf60ae14f693daa9272e0a09ac" ON "aws_service_security_groups" ("service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c011c527aec5c6020fc1484bb1" ON "aws_service_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7" FOREIGN KEY ("cluster_id") REFERENCES "cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_c8f480e0b98911299c6920e7184" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_95900c2acc0286c7976d9b729b2" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_c0c1887e471b1f7c33007a2f420" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_de350ceda5a3f4f5f8786518e6f" FOREIGN KEY ("public_repository_id") REFERENCES "public_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_bf60ae14f693daa9272e0a09ac2" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_c011c527aec5c6020fc1484bb10" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_c011c527aec5c6020fc1484bb10"`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_bf60ae14f693daa9272e0a09ac2"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_de350ceda5a3f4f5f8786518e6f"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_c0c1887e471b1f7c33007a2f420"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_95900c2acc0286c7976d9b729b2"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_c8f480e0b98911299c6920e7184"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c011c527aec5c6020fc1484bb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf60ae14f693daa9272e0a09ac"`);
        await queryRunner.query(`DROP TABLE "aws_service_security_groups"`);
        await queryRunner.query(`DROP TABLE "container_definition"`);
        await queryRunner.query(`DROP TYPE "public"."container_definition_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_cpu_memory_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
        await queryRunner.query(`DROP TABLE "service"`);
        await queryRunner.query(`DROP TYPE "public"."service_assign_public_ip_enum"`);
        await queryRunner.query(`DROP TABLE "cluster"`);
    }

}
