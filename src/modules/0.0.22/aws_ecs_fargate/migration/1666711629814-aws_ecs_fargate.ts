import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsEcsFargate1666711629814 implements MigrationInterface {
  name = 'awsEcsFargate1666711629814';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_cluster_name_region" UNIQUE ("cluster_name", "region"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."service_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "subnets" text array NOT NULL, "assign_public_ip" "public"."service_assign_public_ip_enum" NOT NULL DEFAULT 'DISABLED', "force_new_deployment" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), "cluster_name" integer, "task_definition_id" integer, "target_group_id" integer, CONSTRAINT "uq_service_name_region" UNIQUE ("name", "region"), CONSTRAINT "check_service_subnets" CHECK (check_service_subnets(subnets)), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('vCPU0.25-0.5GB', 'vCPU0.25-1GB', 'vCPU0.25-2GB', 'vCPU0.5-1GB', 'vCPU0.5-2GB', 'vCPU0.5-3GB', 'vCPU0.5-4GB', 'vCPU1-2GB', 'vCPU1-3GB', 'vCPU1-4GB', 'vCPU1-5GB', 'vCPU1-6GB', 'vCPU1-7GB', 'vCPU1-8GB', 'vCPU2-4GB', 'vCPU2-5GB', 'vCPU2-6GB', 'vCPU2-7GB', 'vCPU2-8GB', 'vCPU2-9GB', 'vCPU2-10GB', 'vCPU2-11GB', 'vCPU2-12GB', 'vCPU2-13GB', 'vCPU2-14GB', 'vCPU2-15GB', 'vCPU2-16GB', 'vCPU4-8GB', 'vCPU4-9GB', 'vCPU4-10GB', 'vCPU4-11GB', 'vCPU4-12GB', 'vCPU4-13GB', 'vCPU4-14GB', 'vCPU4-15GB', 'vCPU4-16GB', 'vCPU4-17GB', 'vCPU4-18GB', 'vCPU4-19GB', 'vCPU4-20GB', 'vCPU4-21GB', 'vCPU4-22GB', 'vCPU4-23GB', 'vCPU4-24GB', 'vCPU4-25GB', 'vCPU4-26GB', 'vCPU4-27GB', 'vCPU4-28GB', 'vCPU4-29GB', 'vCPU4-30GB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "status" "public"."task_definition_status_enum", "cpu_memory" "public"."task_definition_cpu_memory_enum", "region" character varying NOT NULL DEFAULT default_aws_region(), "task_role_name" character varying, "execution_role_name" character varying, CONSTRAINT "uq_task_definition_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."container_definition_protocol_enum" AS ENUM('tcp', 'udp')`,
    );
    await queryRunner.query(
      `CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying, "tag" character varying, "digest" character varying, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "host_port" integer, "container_port" integer, "protocol" "public"."container_definition_protocol_enum", "env_variables" text, "region" character varying NOT NULL DEFAULT default_aws_region(), "task_definition_id" integer, "repository_id" integer, "public_repository_name" character varying, "log_group_id" integer, CONSTRAINT "CHK_7c71371f8b24ff4868a039a7a9" CHECK (("tag" is null and "digest" is null) or ("tag" is not null and "digest" is null) or ("tag" is null and "digest" is not null)), CONSTRAINT "CHK_ffbdffa12f42a4d955ddaaf44c" CHECK (("image" is null and ("repository_id" is not null or "public_repository_name" is not null)) or "image" is not null), CONSTRAINT "PK_79458e199ec6b2264a0735fd99e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_security_groups" ("service_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_0986c453e31558a0df78054c409" PRIMARY KEY ("service_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_898ba6a6683e0f309aa8b47f46" ON "service_security_groups" ("service_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0407238e46717099da0443dff7" ON "service_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cluster" ADD CONSTRAINT "FK_2639f93840ace6d5048e4a1f118" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_5a4fe987d7ad1cae04473db3db8" FOREIGN KEY ("cluster_name") REFERENCES "cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_c8f480e0b98911299c6920e7184" FOREIGN KEY ("target_group_id") REFERENCES "target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_55746a49f49deb0b497efcf2ace" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_definition" ADD CONSTRAINT "FK_7ea89f0f48f85fb6182e98603a6" FOREIGN KEY ("task_role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_definition" ADD CONSTRAINT "FK_dcf86a08d8805551fe92f7cd8f1" FOREIGN KEY ("execution_role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_definition" ADD CONSTRAINT "FK_5a2c9b79673407fb4988595a814" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_4f31e06ce7336bc5f3a50f0ba6b" FOREIGN KEY ("task_definition_id", "region") REFERENCES "task_definition"("id","region") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_1e04ff635edd82118b875db54f1" FOREIGN KEY ("repository_id", "region") REFERENCES "repository"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_223740ffb1779c07fbad5853e28" FOREIGN KEY ("public_repository_name") REFERENCES "public_repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" ADD CONSTRAINT "FK_3b62c1840f54b29b45194748154" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" ADD CONSTRAINT "FK_898ba6a6683e0f309aa8b47f466" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" ADD CONSTRAINT "FK_0407238e46717099da0443dff75" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" DROP CONSTRAINT "FK_0407238e46717099da0443dff75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_security_groups" DROP CONSTRAINT "FK_898ba6a6683e0f309aa8b47f466"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_3b62c1840f54b29b45194748154"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_223740ffb1779c07fbad5853e28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_1e04ff635edd82118b875db54f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "container_definition" DROP CONSTRAINT "FK_4f31e06ce7336bc5f3a50f0ba6b"`,
    );
    await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_5a2c9b79673407fb4988595a814"`);
    await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_dcf86a08d8805551fe92f7cd8f1"`);
    await queryRunner.query(`ALTER TABLE "task_definition" DROP CONSTRAINT "FK_7ea89f0f48f85fb6182e98603a6"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_55746a49f49deb0b497efcf2ace"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_c8f480e0b98911299c6920e7184"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
    await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_5a4fe987d7ad1cae04473db3db8"`);
    await queryRunner.query(`ALTER TABLE "cluster" DROP CONSTRAINT "FK_2639f93840ace6d5048e4a1f118"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0407238e46717099da0443dff7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_898ba6a6683e0f309aa8b47f46"`);
    await queryRunner.query(`DROP TABLE "service_security_groups"`);
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
