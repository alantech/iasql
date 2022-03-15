import {MigrationInterface, QueryRunner} from "typeorm";

export class awsElb1646936001669 implements MigrationInterface {
    name = 'awsElb1646936001669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aws_load_balancer_scheme_enum" AS ENUM('internal', 'internet-facing')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_load_balancer_state_enum" AS ENUM('active', 'active_impaired', 'failed', 'provisioning')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_load_balancer_load_balancer_type_enum" AS ENUM('application', 'gateway', 'network')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_load_balancer_ip_address_type_enum" AS ENUM('dualstack', 'ipv4')`);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer" ("id" SERIAL NOT NULL, "load_balancer_name" character varying NOT NULL, "load_balancer_arn" character varying, "dns_name" character varying, "canonical_hosted_zone_id" character varying, "created_time" TIMESTAMP WITH TIME ZONE, "scheme" "public"."aws_load_balancer_scheme_enum" NOT NULL, "state" "public"."aws_load_balancer_state_enum", "load_balancer_type" "public"."aws_load_balancer_load_balancer_type_enum" NOT NULL, "vpc" character varying NOT NULL, "subnets" character varying array, "availability_zones" character varying array, "ip_address_type" "public"."aws_load_balancer_ip_address_type_enum" NOT NULL, "customer_owned_ipv4_pool" character varying, CONSTRAINT "UQ_0da1f9c4e655b7b4b433e8e91d1" UNIQUE ("load_balancer_name"), CONSTRAINT "PK_8ae32084dac3c544fe7642f732e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_target_group_target_type_enum" AS ENUM('alb', 'instance', 'ip', 'lambda')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_target_group_ip_address_type_enum" AS ENUM('ipv4', 'ipv6')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_target_group_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_target_group_health_check_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_target_group_protocol_version_enum" AS ENUM('GRPC', 'HTTP1', 'HTTP2')`);
        await queryRunner.query(`CREATE TABLE "aws_target_group" ("id" SERIAL NOT NULL, "target_group_name" character varying NOT NULL, "target_type" "public"."aws_target_group_target_type_enum" NOT NULL, "target_group_arn" character varying, "ip_address_type" "public"."aws_target_group_ip_address_type_enum", "protocol" "public"."aws_target_group_protocol_enum", "port" integer, "vpc" character varying NOT NULL, "health_check_protocol" "public"."aws_target_group_health_check_protocol_enum", "health_check_port" character varying, "health_check_enabled" boolean, "health_check_interval_seconds" integer, "health_check_timeout_seconds" integer, "healthy_threshold_count" integer, "unhealthy_threshold_count" integer, "health_check_path" character varying, "protocol_version" "public"."aws_target_group_protocol_version_enum", CONSTRAINT "UQ_cf9961c536580e0ac69ab777cd9" UNIQUE ("target_group_name"), CONSTRAINT "PK_0b8e2cf0848ed04023306981d2a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_listener_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."aws_listener_action_type_enum" AS ENUM('forward')`);
        await queryRunner.query(`CREATE TABLE "aws_listener" ("id" SERIAL NOT NULL, "listener_arn" character varying, "port" integer NOT NULL, "protocol" "public"."aws_listener_protocol_enum" NOT NULL, "action_type" "public"."aws_listener_action_type_enum" NOT NULL DEFAULT 'forward', "aws_load_balancer_id" integer NOT NULL, "target_group_id" integer, CONSTRAINT "UQ_load_balancer__port" UNIQUE ("aws_load_balancer_id", "port"), CONSTRAINT "PK_0a7c3e7b90e9d66f7b4415a0e0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer_security_groups" ("aws_load_balancer_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_3cc316644df3d83dcede5bd8066" PRIMARY KEY ("aws_load_balancer_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_29bd06cc56f59ac7183cd08a0d" ON "aws_load_balancer_security_groups" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_db2368302b0d80ab7b182cdf4d" ON "aws_load_balancer_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "aws_listener" ADD CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_listener" ADD CONSTRAINT "FK_28e43e309f56d5b37040af2b180" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_29bd06cc56f59ac7183cd08a0de" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" ADD CONSTRAINT "FK_db2368302b0d80ab7b182cdf4d0" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_db2368302b0d80ab7b182cdf4d0"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups" DROP CONSTRAINT "FK_29bd06cc56f59ac7183cd08a0de"`);
        await queryRunner.query(`ALTER TABLE "aws_listener" DROP CONSTRAINT "FK_28e43e309f56d5b37040af2b180"`);
        await queryRunner.query(`ALTER TABLE "aws_listener" DROP CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db2368302b0d80ab7b182cdf4d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29bd06cc56f59ac7183cd08a0d"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer_security_groups"`);
        await queryRunner.query(`DROP TABLE "aws_listener"`);
        await queryRunner.query(`DROP TYPE "public"."aws_listener_action_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_listener_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "aws_target_group"`);
        await queryRunner.query(`DROP TYPE "public"."aws_target_group_protocol_version_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_target_group_health_check_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_target_group_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_target_group_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_target_group_target_type_enum"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer"`);
        await queryRunner.query(`DROP TYPE "public"."aws_load_balancer_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_load_balancer_load_balancer_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_load_balancer_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."aws_load_balancer_scheme_enum"`);
    }

}
