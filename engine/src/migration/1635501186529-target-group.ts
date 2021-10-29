import {MigrationInterface, QueryRunner} from "typeorm";

export class targetGroup1635501186529 implements MigrationInterface {
    name = 'targetGroup1635501186529'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."target_group_target_type_enum" AS ENUM('alb', 'instance', 'ip', 'lambda')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_ip_address_type_enum" AS ENUM('ipv4', 'ipv6')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_health_check_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_protocol_version_enum" AS ENUM('GRPC', 'HTTP1', 'HTTP2')`);
        await queryRunner.query(`CREATE TABLE "target_group" ("id" SERIAL NOT NULL, "target_group_name" character varying NOT NULL, "target_type" "public"."target_group_target_type_enum" NOT NULL, "target_group_arn" character varying, "ip_address_type" "public"."target_group_ip_address_type_enum", "protocol" "public"."target_group_protocol_enum", "port" integer, "health_check_protocol" "public"."target_group_health_check_protocol_enum", "health_check_port" character varying, "health_check_enabled" boolean, "health_check_interval_seconds" integer, "health_check_timeout_seconds" integer, "healthy_threshold_count" integer, "unhealthy_threshold_count" integer, "health_check_path" character varying, "protocol_version" "public"."target_group_protocol_version_enum", "vpc_id" integer, CONSTRAINT "UQ_1957da369918349223c6d3c01b0" UNIQUE ("target_group_name"), CONSTRAINT "PK_57d677c2f58ffc6255875625d4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "target_group" ADD CONSTRAINT "FK_0dab21fd6a7a46dc52b16c7721d" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "target_group" DROP CONSTRAINT "FK_0dab21fd6a7a46dc52b16c7721d"`);
        await queryRunner.query(`DROP TABLE "target_group"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_protocol_version_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_health_check_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_target_type_enum"`);
    }

}
