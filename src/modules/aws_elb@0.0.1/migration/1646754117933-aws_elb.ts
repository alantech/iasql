import {MigrationInterface, QueryRunner} from "typeorm";

export class awsElb1646754117933 implements MigrationInterface {
    name = 'awsElb1646754117933'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" DROP CONSTRAINT "UQ_rule"`);
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
        await queryRunner.query(`CREATE TABLE "aws_load_balancer_security_groups_aws_security_group" ("aws_load_balancer_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_c2465e5cc8f23e767297c8cdd24" PRIMARY KEY ("aws_load_balancer_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fea480224323d1070588595411" ON "aws_load_balancer_security_groups_aws_security_group" ("aws_load_balancer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_db1c32e5ebacdf20b2ffad7a37" ON "aws_load_balancer_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "aws_listener" ADD CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_listener" ADD CONSTRAINT "FK_28e43e309f56d5b37040af2b180" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" ADD CONSTRAINT "FK_fea480224323d10705885954110" FOREIGN KEY ("aws_load_balancer_id") REFERENCES "aws_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" ADD CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // TODO: Check these
        // Example of use: call create_or_update_aws_load_balancer('test-sp2', 'internal', 'vpc-41895538', 'network', array['subnet-68312820', 'subnet-a58a84c3'], 'ipv4');
        await queryRunner.query(`
            create or replace procedure create_or_update_aws_load_balancer(
                _name text,
                _scheme aws_load_balancer_scheme_enum,
                _vpc_id text,
                _elb_type aws_load_balancer_load_balancer_type_enum,
                _ip_address_type aws_load_balancer_ip_address_type_enum,
                _security_group_names text [] default null
            )
            language plpgsql
            as $$
            declare
                sg record;
                sg_id integer;
                load_balancer_id integer;
            begin
                -- TODO: fix subnets based on vpc
                insert into aws_load_balancer
                    (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
                values
                    (_name, _scheme, _vpc_id, _elb_type, _ip_address_type)
                on conflict (load_balancer_name)
                do update set scheme = _scheme,
                    load_balancer_type = _elb_type,
                    ip_address_type = _ip_address_type,
                    vpc = _vpc_id;
            
                select id into load_balancer_id
                from aws_load_balancer
                where load_balancer_name = _name
                order by id desc
                limit 1;
            
                for sg in
                    select id
                    from aws_security_group
                    where group_name = any(_security_group_names)
                loop
                    insert into aws_load_balancer_security_groups_aws_security_group
                        (aws_load_balancer_id, aws_security_group_id)
                    values
                        (load_balancer_id, sg.id)
                    on conflict do nothing;
                end loop;
                
                delete from aws_load_balancer_security_groups_aws_security_group
                using aws_security_group
                where aws_load_balancer_id = load_balancer_id and aws_security_group.id = aws_load_balancer_security_groups_aws_security_group.aws_security_group_id and not (group_name = any(_security_group_names));
                raise info 'aws_load_balancer_id = %', load_balancer_id;
            end;
            $$;
        `);
        // Example of use: call create_or_update_aws_target_group('test-sp2', 'ip', 8888, 'vpc-41895538', 'TCP', '/health');
        await queryRunner.query(`
            create or replace procedure create_or_update_aws_target_group(
                _name text,
                _target_type aws_target_group_target_type_enum,
                _port integer,
                _vpc_id text,
                _protocol aws_target_group_protocol_enum,
                _health_check_path text default null
            )
            language plpgsql
            as $$
            declare 
                target_group_id integer;
            begin
                insert into aws_target_group
                    (target_group_name, target_type, protocol, port, vpc, health_check_path)
                values
                    (_name, _target_type, _protocol, _port, _vpc_id, _health_check_path)
                on conflict (target_group_name)
                do update set target_type = _target_type,
                    protocol = _protocol,
                    port = _port,
                    vpc = _vpc_id,
                    health_check_path = _health_check_path;
            
                select id into target_group_id
                from aws_target_group
                where target_group_name = _name
                order by id desc
                limit 1;
            
                raise info 'aws_target_group_id = %', target_group_id;
            end;
            $$;
        `);
        // Example of use: call create_or_update_aws_listener('test-sp2', 8888, 'TCP', 'forward', 'test-sp2');
        await queryRunner.query(`
            create or replace procedure create_or_update_aws_listener(
                _load_balancer_name text,
                _port integer,
                _protocol aws_listener_protocol_enum,
                _action_type aws_action_action_type_enum,
                _target_group_name text
            )
            language plpgsql
            as $$
            declare
                l_id integer;
                lb_id integer;
                tg_id integer;
            begin
                select id into tg_id
                from aws_target_group
                where target_group_name = _target_group_name;

                select id into lb_id
                from aws_load_balancer
                where load_balancer_name = _load_balancer_name
                limit 1;

                insert into aws_listener
                    (aws_load_balancer_id, port, protocol, action_type, target_group_id)
                values 
                    (lb_id, _port, _protocol, _action_type, tg_id)
                ON CONFLICT ON CONSTRAINT UQ_load_balancer__port
                DO UPDATE SET protocol = _protocol,
                    action_type = _action_type,
                    target_group_id = tg_id;
                    
                select id into l_id
                from aws_listener
                order by id desc
                limit 1;

                raise info 'aws_listener_id = %', l_id;
            end; 
            $$;
        `);
        // Example of use: call delete_aws_load_balancer('test-sp2');
        await queryRunner.query(`
            create or replace procedure delete_aws_load_balancer(_name text)
            language plpgsql
            as $$
            declare
                load_balancer_id integer;
            begin
                select id into load_balancer_id
                from aws_load_balancer
                where load_balancer_name = _name
                order by id desc
                limit 1;
            
                delete
                from aws_load_balancer_security_groups_aws_security_group
                where aws_load_balancer_id = load_balancer_id;
            
                delete
                from aws_load_balancer
                where load_balancer_name = _name;
            end;
            $$;
        `);
        // Example of use: call delete_aws_target_group('test-sp2');
        await queryRunner.query(`
            create or replace procedure delete_aws_target_group(_name text)
            language plpgsql
            as $$
            begin
                delete
                from aws_target_group
                where target_group_name = _name;
            end;
            $$;
        `);
        // Example of use: call delete_aws_listener('test-sp2', 8888, 'TCP', 'forward', 'test-sp2');
        await queryRunner.query(`
            create or replace procedure delete_aws_listener(
                _load_balancer_name text,
                _port integer,
                _protocol aws_listener_protocol_enum,
                _action_type aws_action_action_type_enum,
                _target_group_name text
            )
            language plpgsql
            as $$
            declare
                a_id integer;
                l_id integer;
                lb_id integer;
                tg_id integer;
            begin
                select id into lb_id
                from aws_load_balancer
                where load_balancer_name = _load_balancer_name
                limit 1;

                select id into tg_id
                from aws_target_group
                where target_group_name = _target_group_name
                order by id desc
                limit 1;
            
                delete from aws_listener
                where aws_load_balancer_id = lb_id and port = _port and protocol = _protocol and action_type = _action_type and target_group_id = tg_id
                order by id desc
                limit 1;
                
            end; 
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure delete_aws_listener;`);
        await queryRunner.query(`DROP procedure delete_aws_target_group;`);
        await queryRunner.query(`DROP procedure delete_aws_load_balancer;`);
        await queryRunner.query(`DROP procedure create_or_update_aws_listener;`);
        await queryRunner.query(`DROP procedure create_or_update_aws_target_group;`);
        await queryRunner.query(`DROP procedure create_or_update_aws_load_balancer;`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" DROP CONSTRAINT "FK_db1c32e5ebacdf20b2ffad7a37a"`);
        await queryRunner.query(`ALTER TABLE "aws_load_balancer_security_groups_aws_security_group" DROP CONSTRAINT "FK_fea480224323d10705885954110"`);
        await queryRunner.query(`ALTER TABLE "aws_listener" DROP CONSTRAINT "FK_28e43e309f56d5b37040af2b180"`);
        await queryRunner.query(`ALTER TABLE "aws_listener" DROP CONSTRAINT "FK_91d0165bf0d56cc965ff5b90a43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db1c32e5ebacdf20b2ffad7a37"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fea480224323d1070588595411"`);
        await queryRunner.query(`DROP TABLE "aws_load_balancer_security_groups_aws_security_group"`);
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
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" ADD CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_id")`);
    }

}
