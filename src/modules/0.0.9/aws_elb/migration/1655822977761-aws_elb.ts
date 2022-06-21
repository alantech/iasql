import {MigrationInterface, QueryRunner} from "typeorm";

export class awsElb1655822977761 implements MigrationInterface {
    name = 'awsElb1655822977761'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."load_balancer_scheme_enum" AS ENUM('internal', 'internet-facing')`);
        await queryRunner.query(`CREATE TYPE "public"."load_balancer_state_enum" AS ENUM('active', 'active_impaired', 'failed', 'provisioning')`);
        await queryRunner.query(`CREATE TYPE "public"."load_balancer_load_balancer_type_enum" AS ENUM('application', 'gateway', 'network')`);
        await queryRunner.query(`CREATE TYPE "public"."load_balancer_ip_address_type_enum" AS ENUM('dualstack', 'ipv4')`);
        await queryRunner.query(`CREATE TABLE "load_balancer" ("load_balancer_name" character varying NOT NULL, "load_balancer_arn" character varying, "dns_name" character varying, "canonical_hosted_zone_id" character varying, "created_time" TIMESTAMP WITH TIME ZONE, "scheme" "public"."load_balancer_scheme_enum" NOT NULL, "state" "public"."load_balancer_state_enum", "load_balancer_type" "public"."load_balancer_load_balancer_type_enum" NOT NULL, "subnets" character varying array, "availability_zones" character varying array, "ip_address_type" "public"."load_balancer_ip_address_type_enum" NOT NULL, "customer_owned_ipv4_pool" character varying, "vpc" integer, CONSTRAINT "PK_752cf6361c52a07bd00d9b7c4dd" PRIMARY KEY ("load_balancer_name"))`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_target_type_enum" AS ENUM('alb', 'instance', 'ip', 'lambda')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_ip_address_type_enum" AS ENUM('ipv4', 'ipv6')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_health_check_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."target_group_protocol_version_enum" AS ENUM('GRPC', 'HTTP1', 'HTTP2')`);
        await queryRunner.query(`CREATE TABLE "target_group" ("target_group_name" character varying NOT NULL, "target_type" "public"."target_group_target_type_enum" NOT NULL, "target_group_arn" character varying, "ip_address_type" "public"."target_group_ip_address_type_enum", "protocol" "public"."target_group_protocol_enum", "port" integer, "health_check_protocol" "public"."target_group_health_check_protocol_enum", "health_check_port" character varying, "health_check_enabled" boolean, "health_check_interval_seconds" integer, "health_check_timeout_seconds" integer, "healthy_threshold_count" integer, "unhealthy_threshold_count" integer, "health_check_path" character varying, "protocol_version" "public"."target_group_protocol_version_enum", "vpc" integer, CONSTRAINT "PK_1957da369918349223c6d3c01b0" PRIMARY KEY ("target_group_name"))`);
        await queryRunner.query(`CREATE TYPE "public"."listener_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "public"."listener_action_type_enum" AS ENUM('forward')`);
        await queryRunner.query(`CREATE TABLE "listener" ("id" SERIAL NOT NULL, "listener_arn" character varying, "port" integer NOT NULL, "protocol" "public"."listener_protocol_enum" NOT NULL, "action_type" "public"."listener_action_type_enum" NOT NULL DEFAULT 'forward', "ssl_policy" character varying, "load_balancer_name" character varying NOT NULL, "target_group_name" character varying NOT NULL, "certificate_id" integer, CONSTRAINT "UQ_load_balancer__port" UNIQUE ("load_balancer_name", "port"), CONSTRAINT "PK_422c9d250eb7b0c0b6c96cdce94" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "load_balancer_security_groups" ("load_balancer_name" character varying NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_c3263aa4b606967900de62e3619" PRIMARY KEY ("load_balancer_name", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e1020e4ee5063ea1f0b20b3c9c" ON "load_balancer_security_groups" ("load_balancer_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_4da7e08287b5693e5b22959ced" ON "load_balancer_security_groups" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "load_balancer" ADD CONSTRAINT "FK_85469e168fb53493324102075fe" FOREIGN KEY ("vpc") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "target_group" ADD CONSTRAINT "FK_5e47493d36e4558ffb2418ef961" FOREIGN KEY ("vpc") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "listener" ADD CONSTRAINT "FK_f2eeab1baaafa48081a9d4a1467" FOREIGN KEY ("load_balancer_name") REFERENCES "load_balancer"("load_balancer_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "listener" ADD CONSTRAINT "FK_04ac33f934f532bfd0227d49997" FOREIGN KEY ("target_group_name") REFERENCES "target_group"("target_group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "listener" ADD CONSTRAINT "FK_21beaace54890e2a63d2150a56b" FOREIGN KEY ("certificate_id") REFERENCES "certificate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "load_balancer_security_groups" ADD CONSTRAINT "FK_e1020e4ee5063ea1f0b20b3c9ce" FOREIGN KEY ("load_balancer_name") REFERENCES "load_balancer"("load_balancer_name") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "load_balancer_security_groups" ADD CONSTRAINT "FK_4da7e08287b5693e5b22959ced4" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "load_balancer_security_groups" DROP CONSTRAINT "FK_4da7e08287b5693e5b22959ced4"`);
        await queryRunner.query(`ALTER TABLE "load_balancer_security_groups" DROP CONSTRAINT "FK_e1020e4ee5063ea1f0b20b3c9ce"`);
        await queryRunner.query(`ALTER TABLE "listener" DROP CONSTRAINT "FK_21beaace54890e2a63d2150a56b"`);
        await queryRunner.query(`ALTER TABLE "listener" DROP CONSTRAINT "FK_04ac33f934f532bfd0227d49997"`);
        await queryRunner.query(`ALTER TABLE "listener" DROP CONSTRAINT "FK_f2eeab1baaafa48081a9d4a1467"`);
        await queryRunner.query(`ALTER TABLE "target_group" DROP CONSTRAINT "FK_5e47493d36e4558ffb2418ef961"`);
        await queryRunner.query(`ALTER TABLE "load_balancer" DROP CONSTRAINT "FK_85469e168fb53493324102075fe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4da7e08287b5693e5b22959ced"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e1020e4ee5063ea1f0b20b3c9c"`);
        await queryRunner.query(`DROP TABLE "load_balancer_security_groups"`);
        await queryRunner.query(`DROP TABLE "listener"`);
        await queryRunner.query(`DROP TYPE "public"."listener_action_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."listener_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "target_group"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_protocol_version_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_health_check_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."target_group_target_type_enum"`);
        await queryRunner.query(`DROP TABLE "load_balancer"`);
        await queryRunner.query(`DROP TYPE "public"."load_balancer_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."load_balancer_load_balancer_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."load_balancer_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."load_balancer_scheme_enum"`);
    }

}
