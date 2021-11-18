import {MigrationInterface, QueryRunner} from "typeorm";

export class awsElb1637275424293 implements MigrationInterface {
    name = 'awsElb1637275424293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "aws_load_balancer_scheme_enum" AS ENUM('internal', 'internet-facing')`);
        await queryRunner.query(`CREATE TYPE "aws_load_balancer_state_enum" AS ENUM('active', 'active_impaired', 'failed', 'provisioning')`);
        await queryRunner.query(`CREATE TYPE "aws_load_balancer_load_balancer_type_enum" AS ENUM('application', 'gateway', 'network')`);
        await queryRunner.query(`CREATE TYPE "aws_load_balancer_ip_address_type_enum" AS ENUM('dualstack', 'ipv4')`);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer" ("id" SERIAL NOT NULL, "load_balancer_name" character varying NOT NULL, "load_balancer_arn" character varying, "dns_name" character varying, "canonical_hosted_zone_id" character varying, "created_time" TIMESTAMP WITH TIME ZONE, "scheme" "aws_load_balancer_scheme_enum" NOT NULL, "state" "aws_load_balancer_state_enum", "load_balancer_type" "aws_load_balancer_load_balancer_type_enum" NOT NULL, "ip_address_type" "aws_load_balancer_ip_address_type_enum" NOT NULL, "customer_owned_ipv4pool" character varying, "vpc_id" integer, CONSTRAINT "UQ_0da1f9c4e655b7b4b433e8e91d1" UNIQUE ("load_balancer_name"), CONSTRAINT "PK_8ae32084dac3c544fe7642f732e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_target_group_target_type_enum" AS ENUM('alb', 'instance', 'ip', 'lambda')`);
        await queryRunner.query(`CREATE TYPE "aws_target_group_ip_address_type_enum" AS ENUM('ipv4', 'ipv6')`);
        await queryRunner.query(`CREATE TYPE "aws_target_group_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "aws_target_group_health_check_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TYPE "aws_target_group_protocol_version_enum" AS ENUM('GRPC', 'HTTP1', 'HTTP2')`);
        await queryRunner.query(`CREATE TABLE "aws_target_group" ("id" SERIAL NOT NULL, "target_group_name" character varying NOT NULL, "target_type" "aws_target_group_target_type_enum" NOT NULL, "target_group_arn" character varying, "ip_address_type" "aws_target_group_ip_address_type_enum", "protocol" "aws_target_group_protocol_enum", "port" integer, "health_check_protocol" "aws_target_group_health_check_protocol_enum", "health_check_port" character varying, "health_check_enabled" boolean, "health_check_interval_seconds" integer, "health_check_timeout_seconds" integer, "healthy_threshold_count" integer, "unhealthy_threshold_count" integer, "health_check_path" character varying, "protocol_version" "aws_target_group_protocol_version_enum", "vpc_id" integer, CONSTRAINT "UQ_cf9961c536580e0ac69ab777cd9" UNIQUE ("target_group_name"), CONSTRAINT "PK_0b8e2cf0848ed04023306981d2a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_listener_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TABLE "aws_listener" ("id" SERIAL NOT NULL, "listener_arn" character varying, "port" integer NOT NULL, "protocol" "aws_listener_protocol_enum" NOT NULL, "aws_load_balancer_id" integer NOT NULL, CONSTRAINT "PK_0a7c3e7b90e9d66f7b4415a0e0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "aws_action_action_type_enum" AS ENUM('forward')`);
        await queryRunner.query(`CREATE TABLE "aws_action" ("id" SERIAL NOT NULL, "action_type" "aws_action_action_type_enum" NOT NULL, "target_group_id" integer NOT NULL, CONSTRAINT "PK_1788d4975e1ae1475268e0e10fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer_subnets_aws_subnet" ("aws_load_balancer_id" integer NOT NULL, "aws_subnet_id" integer NOT NULL, CONSTRAINT "PK_103627c331bc977e2b5d1c3bfc2" PRIMARY KEY ("aws_load_balancer_id", "aws_subnet_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a641a96031b6e2b3ae4e231c41" ON "aws_load_balancer_subnets_aws_subnet" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_41d65e026247125582194e9a6f" ON "aws_load_balancer_subnets_aws_subnet" ("aws_subnet_id") `);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer_availability_zones_availability_zone" ("aws_load_balancer_id" integer NOT NULL, "availability_zone_id" integer NOT NULL, CONSTRAINT "PK_e899fbd6d9548ddd91dfb73b1d1" PRIMARY KEY ("aws_load_balancer_id", "availability_zone_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d4267dfad94c92a741325a4f52" ON "aws_load_balancer_availability_zones_availability_zone" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a9bfcd14668baba48752465f6a" ON "aws_load_balancer_availability_zones_availability_zone" ("availability_zone_id") `);
        await queryRunner.query(`CREATE TABLE "aws_load_balancer_security_groups_aws_security_group" ("aws_load_balancer_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_c2465e5cc8f23e767297c8cdd24" PRIMARY KEY ("aws_load_balancer_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fea480224323d1070588595411" ON "aws_load_balancer_security_groups_aws_security_group" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_db1c32e5ebacdf20b2ffad7a37" ON "aws_load_balancer_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`CREATE TABLE "aws_listener_default_actions_aws_action" ("aws_listener_id" integer NOT NULL, "aws_action_id" integer NOT NULL, CONSTRAINT "PK_0d075d6702cfbbc3952e83f0025" PRIMARY KEY ("aws_listener_id", "aws_action_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d8aa3feff946c2b366fad035de" ON "aws_listener_default_actions_aws_action" ("aws_listener_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3a5ce81218da8536275396ca4d" ON "aws_listener_default_actions_aws_action" ("aws_action_id") `);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer" ADD CONSTRAINT "FK_5666af9c322a36e851695d546d6" FOREIGN KEY ("vpc_id") REFERENCES "aws_vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_target_group" ADD CONSTRAINT "FK_599bbcc178e75ce9dd8bc5c2a41" FOREIGN KEY ("vpc_id") REFERENCES "aws_vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_listener" ADD CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_action" ADD CONSTRAINT "FK_94ce7359689120bff0c21ea6022" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_subnets_aws_subnet" ADD CONSTRAINT "FK_a641a96031b6e2b3ae4e231c41d" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_subnets_aws_subnet" ADD CONSTRAINT "FK_41d65e026247125582194e9a6fb" FOREIGN KEY ("aws_subnet_id") REFERENCES "aws_subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_availability_zones_availability_zone" ADD CONSTRAINT "FK_d4267dfad94c92a741325a4f52b" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_availability_zones_availability_zone" ADD CONSTRAINT "FK_a9bfcd14668baba48752465f6a8" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" ADD CONSTRAINT "FK_fea480224323d10705885954110" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" ADD CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_listener_default_actions_aws_action" ADD CONSTRAINT "FK_d8aa3feff946c2b366fad035de1" FOREIGN KEY ("aws_listener_id") REFERENCES "aws_listener"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_listener_default_actions_aws_action" ADD CONSTRAINT "FK_3a5ce81218da8536275396ca4d9" FOREIGN KEY ("aws_action_id") REFERENCES "aws_action"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_listener_default_actions_aws_action" DROP CONSTRAINT "FK_3a5ce81218da8536275396ca4d9"`);
        await queryRunner.query(`ALTER TABLE "aws_listener_default_actions_aws_action" DROP CONSTRAINT "FK_d8aa3feff946c2b366fad035de1"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" DROP CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" DROP CONSTRAINT "FK_fea480224323d10705885954110"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_availability_zones_availability_zone" DROP CONSTRAINT "FK_a9bfcd14668baba48752465f6a8"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_availability_zones_availability_zone" DROP CONSTRAINT "FK_d4267dfad94c92a741325a4f52b"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_subnets_aws_subnet" DROP CONSTRAINT "FK_41d65e026247125582194e9a6fb"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_subnets_aws_subnet" DROP CONSTRAINT "FK_a641a96031b6e2b3ae4e231c41d"`);
        await queryRunner.query(`ALTER TABLE "aws_action" DROP CONSTRAINT "FK_94ce7359689120bff0c21ea6022"`);
        await queryRunner.query(`ALTER TABLE "aws_listener" DROP CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43"`);
        await queryRunner.query(`ALTER TABLE "aws_target_group" DROP CONSTRAINT "FK_599bbcc178e75ce9dd8bc5c2a41"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer" DROP CONSTRAINT "FK_5666af9c322a36e851695d546d6"`);
        await queryRunner.query(`DROP INDEX "IDX_3a5ce81218da8536275396ca4d"`);
        await queryRunner.query(`DROP INDEX "IDX_d8aa3feff946c2b366fad035de"`);
        await queryRunner.query(`DROP TABLE "aws_listener_default_actions_aws_action"`);
        await queryRunner.query(`DROP INDEX "IDX_db1c32e5ebacdf20b2ffad7a37"`);
        await queryRunner.query(`DROP INDEX "IDX_fea480224323d1070588595411"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP INDEX "IDX_a9bfcd14668baba48752465f6a"`);
        await queryRunner.query(`DROP INDEX "IDX_d4267dfad94c92a741325a4f52"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer_availability_zones_availability_zone"`);
        await queryRunner.query(`DROP INDEX "IDX_41d65e026247125582194e9a6f"`);
        await queryRunner.query(`DROP INDEX "IDX_a641a96031b6e2b3ae4e231c41"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer_subnets_aws_subnet"`);
        await queryRunner.query(`DROP TABLE "aws_action"`);
        await queryRunner.query(`DROP TYPE "aws_action_action_type_enum"`);
        await queryRunner.query(`DROP TABLE "aws_listener"`);
        await queryRunner.query(`DROP TYPE "aws_listener_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "aws_target_group"`);
        await queryRunner.query(`DROP TYPE "aws_target_group_protocol_version_enum"`);
        await queryRunner.query(`DROP TYPE "aws_target_group_health_check_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "aws_target_group_protocol_enum"`);
        await queryRunner.query(`DROP TYPE "aws_target_group_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "aws_target_group_target_type_enum"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer"`);
        await queryRunner.query(`DROP TYPE "aws_load_balancer_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "aws_load_balancer_load_balancer_type_enum"`);
        await queryRunner.query(`DROP TYPE "aws_load_balancer_state_enum"`);
        await queryRunner.query(`DROP TYPE "aws_load_balancer_scheme_enum"`);
    }

}
