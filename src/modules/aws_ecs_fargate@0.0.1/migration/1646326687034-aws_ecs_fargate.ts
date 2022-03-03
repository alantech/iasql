import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcsFargate1646326687034 implements MigrationInterface {
    name = 'awsEcsFargate1646326687034'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_ae49990501587fb65eb6c329980" UNIQUE ("cluster_name"), CONSTRAINT "PK_9e69a6eb4ebabef29beca79943c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "env_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, "container_definition_id" integer, CONSTRAINT "PK_87fd48bd952a768fcf07b9c9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, "container_definition_id" integer, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_service_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "aws_service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "subnets" text array, "assign_public_ip" "public"."aws_service_assign_public_ip_enum" NOT NULL DEFAULT 'DISABLED', "cluster_id" integer, "task_definition_id" integer, "target_group_id" integer, "container_definition_id" integer, CONSTRAINT "UQ_92bc64cc395f8397b7f940fecc3" UNIQUE ("name"), CONSTRAINT "PK_d4e4fbff20bd61cbee79b511bc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_task_definition_cpu_memory_enum" AS ENUM('0.25vCPU-0.5GB', '0.25vCPU-1GB', '0.25vCPU-2GB', '0.5vCPU-1GB', '0.5vCPU-2GB', '0.5vCPU-3GB', '0.5vCPU-4GB', '1vCPU-2GB', '1vCPU-3GB', '1vCPU-4GB', '1vCPU-5GB', '1vCPU-6GB', '1vCPU-7GB', '1vCPU-8GB', '2vCPU-4GB', '2vCPU-5GB', '2vCPU-6GB', '2vCPU-7GB', '2vCPU-8GB', '2vCPU-9GB', '2vCPU-10GB', '2vCPU-11GB', '2vCPU-12GB', '2vCPU-13GB', '2vCPU-14GB', '2vCPU-15GB', '2vCPU-16GB', '4vCPU-8GB', '4vCPU-9GB', '4vCPU-10GB', '4vCPU-11GB', '4vCPU-12GB', '4vCPU-13GB', '4vCPU-14GB', '4vCPU-15GB', '4vCPU-16GB', '4vCPU-17GB', '4vCPU-18GB', '4vCPU-19GB', '4vCPU-20GB', '4vCPU-21GB', '4vCPU-22GB', '4vCPU-23GB', '4vCPU-24GB', '4vCPU-25GB', '4vCPU-26GB', '4vCPU-27GB', '4vCPU-28GB', '4vCPU-29GB', '4vCPU-30GB')`);
        await queryRunner.query(`CREATE TABLE "aws_task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "task_role_arn" character varying, "execution_role_arn" character varying, "status" "public"."aws_task_definition_status_enum", "cpu_memory" "public"."aws_task_definition_cpu_memory_enum", CONSTRAINT "PK_54b9474072b93b053b27ae18af5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "docker_image" character varying, "tag" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "task_definition_id" integer, "repository_id" integer, "public_repository_id" integer, "log_group_id" integer, CONSTRAINT "CHK_0425e56c67a784b286bd55038e" CHECK ("docker_image" is not null or "repository_id" is not null  or "public_repository_id" is not null), CONSTRAINT "PK_82905170a50ef6bbf6931d799a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_service_security_groups_aws_security_group" ("aws_service_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_bf9993dc90d80ef29ebbe014fd6" PRIMARY KEY ("aws_service_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1a23ea9db1c8414857b1955d6e" ON "aws_service_security_groups_aws_security_group" ("aws_service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da22d8740bd7f4f25b9e4f7cf4" ON "aws_service_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "env_variable" ADD CONSTRAINT "FK_0970dc837808961fbabd6ac0c20" FOREIGN KEY ("container_definition_id") REFERENCES "aws_container_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "port_mapping" ADD CONSTRAINT "FK_6a6939c3fa28fccb0b40ad5a585" FOREIGN KEY ("container_definition_id") REFERENCES "aws_container_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab" FOREIGN KEY ("cluster_id") REFERENCES "aws_cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_7a25de2a32c13c7583d1905a63e" FOREIGN KEY ("container_definition_id") REFERENCES "aws_container_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_22ad0cd60293360bdc81fe67426" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5" FOREIGN KEY ("public_repository_id") REFERENCES "aws_public_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_535959b3981bc7f5351dd539c7a" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups_aws_security_group" ADD CONSTRAINT "FK_1a23ea9db1c8414857b1955d6ea" FOREIGN KEY ("aws_service_id") REFERENCES "aws_service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups_aws_security_group" ADD CONSTRAINT "FK_da22d8740bd7f4f25b9e4f7cf46" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups_aws_security_group" DROP CONSTRAINT "FK_da22d8740bd7f4f25b9e4f7cf46"`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups_aws_security_group" DROP CONSTRAINT "FK_1a23ea9db1c8414857b1955d6ea"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_535959b3981bc7f5351dd539c7a"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_22ad0cd60293360bdc81fe67426"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_7a25de2a32c13c7583d1905a63e"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab"`);
        await queryRunner.query(`ALTER TABLE "port_mapping" DROP CONSTRAINT "FK_6a6939c3fa28fccb0b40ad5a585"`);
        await queryRunner.query(`ALTER TABLE "env_variable" DROP CONSTRAINT "FK_0970dc837808961fbabd6ac0c20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da22d8740bd7f4f25b9e4f7cf4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a23ea9db1c8414857b1955d6e"`);
        await queryRunner.query(`DROP TABLE "aws_service_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "aws_container_definition"`);
        await queryRunner.query(`DROP TABLE "aws_task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."aws_task_definition_cpu_memory_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_task_definition_status_enum"`);
        await queryRunner.query(`DROP TABLE "aws_service"`);
        await queryRunner.query(`DROP TYPE "public"."aws_service_assign_public_ip_enum"`);
        await queryRunner.query(`DROP TABLE "port_mapping"`);
        await queryRunner.query(`DROP TYPE "public"."port_mapping_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "env_variable"`);
        await queryRunner.query(`DROP TABLE "aws_cluster"`);
    }

}
