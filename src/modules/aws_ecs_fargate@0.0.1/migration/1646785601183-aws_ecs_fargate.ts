import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcsFargate1646785601183 implements MigrationInterface {
    name = 'awsEcsFargate1646785601183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_fea480224323d10705885954110"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fea480224323d1070588595411"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db1c32e5ebacdf20b2ffad7a37"`);
        await queryRunner.query(`CREATE TABLE "aws_cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_ae49990501587fb65eb6c329980" UNIQUE ("cluster_name"), CONSTRAINT "PK_9e69a6eb4ebabef29beca79943c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_service_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "aws_service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "subnets" text array NOT NULL, "assign_public_ip" "public"."aws_service_assign_public_ip_enum" NOT NULL DEFAULT 'DISABLED', "cluster_id" integer, "task_definition_id" integer, "target_group_id" integer, CONSTRAINT "UQ_92bc64cc395f8397b7f940fecc3" UNIQUE ("name"), CONSTRAINT "PK_d4e4fbff20bd61cbee79b511bc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_task_definition_cpu_memory_enum" AS ENUM('0.25vCPU-0.5GB', '0.25vCPU-1GB', '0.25vCPU-2GB', '0.5vCPU-1GB', '0.5vCPU-2GB', '0.5vCPU-3GB', '0.5vCPU-4GB', '1vCPU-2GB', '1vCPU-3GB', '1vCPU-4GB', '1vCPU-5GB', '1vCPU-6GB', '1vCPU-7GB', '1vCPU-8GB', '2vCPU-4GB', '2vCPU-5GB', '2vCPU-6GB', '2vCPU-7GB', '2vCPU-8GB', '2vCPU-9GB', '2vCPU-10GB', '2vCPU-11GB', '2vCPU-12GB', '2vCPU-13GB', '2vCPU-14GB', '2vCPU-15GB', '2vCPU-16GB', '4vCPU-8GB', '4vCPU-9GB', '4vCPU-10GB', '4vCPU-11GB', '4vCPU-12GB', '4vCPU-13GB', '4vCPU-14GB', '4vCPU-15GB', '4vCPU-16GB', '4vCPU-17GB', '4vCPU-18GB', '4vCPU-19GB', '4vCPU-20GB', '4vCPU-21GB', '4vCPU-22GB', '4vCPU-23GB', '4vCPU-24GB', '4vCPU-25GB', '4vCPU-26GB', '4vCPU-27GB', '4vCPU-28GB', '4vCPU-29GB', '4vCPU-30GB')`);
        await queryRunner.query(`CREATE TABLE "aws_task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "task_role_arn" character varying, "execution_role_arn" character varying, "status" "public"."aws_task_definition_status_enum", "cpu_memory" "public"."aws_task_definition_cpu_memory_enum", CONSTRAINT "PK_54b9474072b93b053b27ae18af5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_container_definition_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "aws_container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "docker_image" character varying, "tag" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "host_port" integer, "container_port" integer, "protocol" "public"."aws_container_definition_protocol_enum", "env_variables" text, "task_definition_id" integer, "repository_id" integer, "public_repository_id" integer, "log_group_id" integer, CONSTRAINT "CHK_0425e56c67a784b286bd55038e" CHECK ("docker_image" is not null or "repository_id" is not null  or "public_repository_id" is not null), CONSTRAINT "PK_82905170a50ef6bbf6931d799a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_service_security_groups" ("aws_service_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_4bfcdbfe1939bc8289af2a4e476" PRIMARY KEY ("aws_service_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f67477ae38456964fdd0084f73" ON "aws_service_security_groups" ("aws_service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c011c527aec5c6020fc1484bb1" ON "aws_service_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_29bd06cc56f59ac7183cd08a0d" ON "aws_load_balancer_security_groups" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_db2368302b0d80ab7b182cdf4d" ON "aws_load_balancer_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab" FOREIGN KEY ("cluster_id") REFERENCES "aws_cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_22ad0cd60293360bdc81fe67426" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5" FOREIGN KEY ("public_repository_id") REFERENCES "aws_public_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_535959b3981bc7f5351dd539c7a" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_29bd06cc56f59ac7183cd08a0de" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_db2368302b0d80ab7b182cdf4d0" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_f67477ae38456964fdd0084f735" FOREIGN KEY ("aws_service_id") REFERENCES "aws_service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_c011c527aec5c6020fc1484bb10" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_c011c527aec5c6020fc1484bb10"`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_f67477ae38456964fdd0084f735"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_db2368302b0d80ab7b182cdf4d0"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_29bd06cc56f59ac7183cd08a0de"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_535959b3981bc7f5351dd539c7a"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_22ad0cd60293360bdc81fe67426"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db2368302b0d80ab7b182cdf4d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bd06cc56f59ac7183cd08a0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c011c527aec5c6020fc1484bb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f67477ae38456964fdd0084f73"`);
        await queryRunner.query(`DROP TABLE "aws_service_security_groups"`);
        await queryRunner.query(`DROP TABLE "aws_container_definition"`);
        await queryRunner.query(`DROP TYPE "public"."aws_container_definition_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "aws_task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."aws_task_definition_cpu_memory_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_task_definition_status_enum"`);
        await queryRunner.query(`DROP TABLE "aws_service"`);
        await queryRunner.query(`DROP TYPE "public"."aws_service_assign_public_ip_enum"`);
        await queryRunner.query(`DROP TABLE "aws_cluster"`);
        await queryRunner.query(`CREATE INDEX "IDX_db1c32e5ebacdf20b2ffad7a37" ON "aws_load_balancer_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fea480224323d1070588595411" ON "aws_load_balancer_security_groups" ("aws_load_balancer_id") `);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_fea480224323d10705885954110" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
