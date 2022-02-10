import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcs1644518325187 implements MigrationInterface {
    name = 'awsEcs1644518325187'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aws_vpc_conf_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf" ("id" SERIAL NOT NULL, "subnets" text array NOT NULL, "assign_public_ip" "public"."aws_vpc_conf_assign_public_ip_enum", CONSTRAINT "PK_23873df17bd3e0744254b4ccd9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_45ffb6495d51fdc55df46102ce7" UNIQUE ("cluster_name"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."compatibility_name_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TABLE "compatibility" ("id" SERIAL NOT NULL, "name" "public"."compatibility_name_enum" NOT NULL, CONSTRAINT "UQ_794090c3afd5f43dba2c9fcd631" UNIQUE ("name"), CONSTRAINT "PK_254bde74086e8e3ef50174c3e60" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "env_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_87fd48bd952a768fcf07b9c9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "docker_image" character varying, "tag" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "repository_id" integer, "public_repository_id" integer, "log_group_id" integer, CONSTRAINT "CHK_0047d7f99860fa8a248ce642a0" CHECK ("docker_image" is not null or "repository_id" is not null  or "public_repository_id" is not null), CONSTRAINT "PK_79458e199ec6b2264a0735fd99e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."service_launch_type_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TYPE "public"."service_scheduling_strategy_enum" AS ENUM('DAEMON', 'REPLICA')`);
        await queryRunner.query(`CREATE TABLE "service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "launch_type" "public"."service_launch_type_enum" NOT NULL, "scheduling_strategy" "public"."service_scheduling_strategy_enum" NOT NULL, "cluster_id" integer, "task_definition_id" integer, "aws_vpc_conf_id" integer, CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE ("name"), CONSTRAINT "REL_aeef40fe1f9b32afe23174bb9a" UNIQUE ("aws_vpc_conf_id"), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "service_load_balancer" ("id" SERIAL NOT NULL, "container_name" character varying NOT NULL, "container_port" integer NOT NULL, "target_group_id" integer, "elb_id" integer, CONSTRAINT "PK_4cc8d175d0a19a9109ed66ea512" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_network_mode_enum" AS ENUM('awsvpc', 'bridge', 'host', 'none')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('0.25vCPU-0.5GB', '0.25vCPU-1GB', '0.25vCPU-2GB', '0.5vCPU-1GB', '0.5vCPU-2GB', '0.5vCPU-3GB', '0.5vCPU-4GB', '1vCPU-2GB', '1vCPU-3GB', '1vCPU-4GB', '1vCPU-5GB', '1vCPU-6GB', '1vCPU-7GB', '1vCPU-8GB', '2vCPU-4GB', '2vCPU-5GB', '2vCPU-6GB', '2vCPU-7GB', '2vCPU-8GB', '2vCPU-9GB', '2vCPU-10GB', '2vCPU-11GB', '2vCPU-12GB', '2vCPU-13GB', '2vCPU-14GB', '2vCPU-15GB', '2vCPU-16GB', '4vCPU-8GB', '4vCPU-9GB', '4vCPU-10GB', '4vCPU-11GB', '4vCPU-12GB', '4vCPU-13GB', '4vCPU-14GB', '4vCPU-15GB', '4vCPU-16GB', '4vCPU-17GB', '4vCPU-18GB', '4vCPU-19GB', '4vCPU-20GB', '4vCPU-21GB', '4vCPU-22GB', '4vCPU-23GB', '4vCPU-24GB', '4vCPU-25GB', '4vCPU-26GB', '4vCPU-27GB', '4vCPU-28GB', '4vCPU-29GB', '4vCPU-30GB')`);
        await queryRunner.query(`CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "task_role_arn" character varying, "execution_role_arn" character varying, "network_mode" "public"."task_definition_network_mode_enum", "status" "public"."task_definition_status_enum", "cpu_memory" "public"."task_definition_cpu_memory_enum", CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf_security_groups_aws_security_group" ("aws_vpc_conf_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_381c06538cc2ceecfc32c5d1d0d" PRIMARY KEY ("aws_vpc_conf_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8116cb0c3612c3d1aaffbb8668" ON "aws_vpc_conf_security_groups_aws_security_group" ("aws_vpc_conf_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_aac9c17252dad57f56f18df04c" ON "aws_vpc_conf_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`CREATE TABLE "container_definition_port_mappings_port_mapping" ("container_definition_id" integer NOT NULL, "port_mapping_id" integer NOT NULL, CONSTRAINT "PK_cd68e8ce9f3e67cc4c5d7594261" PRIMARY KEY ("container_definition_id", "port_mapping_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c9e7dd2ccbf3da95dc83aade5" ON "container_definition_port_mappings_port_mapping" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cf0edf6692e95228082e81bd11" ON "container_definition_port_mappings_port_mapping" ("port_mapping_id") `);
        await queryRunner.query(`CREATE TABLE "container_definition_environment_env_variable" ("container_definition_id" integer NOT NULL, "env_variable_id" integer NOT NULL, CONSTRAINT "PK_3a96c31ab1a8d525e39bd193279" PRIMARY KEY ("container_definition_id", "env_variable_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5db64a61c31484513dd1507099" ON "container_definition_environment_env_variable" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8bcc496c6c0336cb275758ec97" ON "container_definition_environment_env_variable" ("env_variable_id") `);
        await queryRunner.query(`CREATE TABLE "service_load_balancers_service_load_balancer" ("service_id" integer NOT NULL, "service_load_balancer_id" integer NOT NULL, CONSTRAINT "PK_76e9299dcd9aa45dc8838447d6d" PRIMARY KEY ("service_id", "service_load_balancer_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_07133468e6971294c9960d7b25" ON "service_load_balancers_service_load_balancer" ("service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6e5bf1aa2a280f96dd7afaf7e" ON "service_load_balancers_service_load_balancer" ("service_load_balancer_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_containers_container_definition" ("task_definition_id" integer NOT NULL, "container_definition_id" integer NOT NULL, CONSTRAINT "PK_71f4fa65784389868575144e940" PRIMARY KEY ("task_definition_id", "container_definition_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b52ff2172cca7171edecacf99c" ON "task_definition_containers_container_definition" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80552f2df19a542a657b6759" ON "task_definition_containers_container_definition" ("container_definition_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_req_compatibilities_compatibility" ("task_definition_id" integer NOT NULL, "compatibility_id" integer NOT NULL, CONSTRAINT "PK_baf64abcea837eac4b5a95a63d9" PRIMARY KEY ("task_definition_id", "compatibility_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0909ccc9eddf3c92a777291256" ON "task_definition_req_compatibilities_compatibility" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f19b7360a189526c59b4387a95" ON "task_definition_req_compatibilities_compatibility" ("compatibility_id") `);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_c0c1887e471b1f7c33007a2f420" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_de350ceda5a3f4f5f8786518e6f" FOREIGN KEY ("public_repository_id") REFERENCES "aws_public_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container_definition" ADD CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7" FOREIGN KEY ("cluster_id") REFERENCES "cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_fed6565f2a94539d1d57d25f798" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_363118760aef03b1cfe65809a7c" FOREIGN KEY ("elb_id") REFERENCES "aws_load_balancer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" ADD CONSTRAINT "FK_8116cb0c3612c3d1aaffbb86683" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" ADD CONSTRAINT "FK_aac9c17252dad57f56f18df04cb" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_1c9e7dd2ccbf3da95dc83aade5d" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_cf0edf6692e95228082e81bd11b" FOREIGN KEY ("port_mapping_id") REFERENCES "port_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_env_variable" ADD CONSTRAINT "FK_5db64a61c31484513dd1507099e" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_env_variable" ADD CONSTRAINT "FK_8bcc496c6c0336cb275758ec97e" FOREIGN KEY ("env_variable_id") REFERENCES "env_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_07133468e6971294c9960d7b25a" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec" FOREIGN KEY ("service_load_balancer_id") REFERENCES "service_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container_definition" ADD CONSTRAINT "FK_b52ff2172cca7171edecacf99c7" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container_definition" ADD CONSTRAINT "FK_9e80552f2df19a542a657b67595" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_0909ccc9eddf3c92a7772912562" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_f19b7360a189526c59b4387a953" FOREIGN KEY ("compatibility_id") REFERENCES "compatibility"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // TODO: Double check these
        // Example of use: call create_ecs_cluster('test-sp');
        await queryRunner.query(`
            create or replace procedure create_ecs_cluster(_name text)
            language plpgsql
            as $$
            declare 
                cluster_id integer;
            begin
                insert into cluster
                    (cluster_name)
                values
                    (_name)
                on conflict (cluster_name)
                do nothing;
            
                select id into cluster_id
                from cluster
                where cluster_name = _name
                order by id desc
                limit 1;
            
                raise info 'cluster_id = %', cluster_id;
            end;
            $$;
        `);
        // Example of use:
        // docker image: call create_container_definition('task-test-sp', 'test-sp', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_docker_image := 'postgres');
        // ecr repository: call create_container_definition('task-test-sp', 'test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_ecr_repository_name := 'test2');
        // error example: call create_container_definition('task-test-sp', 'test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4');
        await queryRunner.query(`
            create or replace procedure create_container_definition(
                _task_definition_family text,
                _name text,
                _essential boolean,
                _memory_reservation integer,
                _host_port integer,
                _container_port integer,
                _protocol port_mapping_protocol_enum,
                _environment_variables json,
                _image_tag text,
                _docker_image text default null,
                _ecr_repository_name text default null,
                _ecr_public_repository_name text default null,
                _cloud_watch_log_group text default null
            )
            language plpgsql
            as $$
                declare
                    c_id integer;
                    pm_id integer;
                    key text;
                    val text;
                    ev_id integer;
                    ecr_repository_id integer;
                    ecr_public_repository_id integer;
                    cw_log_group_id integer;
                    td_id integer;
                begin
            
                    assert (_docker_image is null and _ecr_public_repository_name is null and _ecr_repository_name is not null) or (_docker_image is not null and _ecr_public_repository_name is null and _ecr_repository_name is null) or (_docker_image is null and _ecr_public_repository_name is not null and _ecr_repository_name is null), '_docker_image, _ecr_repository_name or _ecr_public_repository_name need to be defined';
            
                    select id into cw_log_group_id
                    from log_group
                    where log_group_name = _cloud_watch_log_group
                    limit 1;

                    if _ecr_repository_name is not null then
                        select id into ecr_repository_id
                        from aws_repository
                        where repository_name = _ecr_repository_name
                        limit 1;
            
                        insert into container_definition
                            (name, repository_id, tag, essential, memory_reservation, log_group_id)
                        values
                            (_name, ecr_repository_id, _image_tag, _essential, _memory_reservation, cw_log_group_id);
                    elsif _ecr_public_repository_name is not null then
                        select id into ecr_public_repository_id
                        from aws_public_repository
                        where repository_name = _ecr_public_repository_name
                        limit 1;
            
                        insert into container_definition
                            (name, public_repository_id, tag, essential, memory_reservation, log_group_id)
                        values
                            (_name, ecr_public_repository_id, _image_tag, _essential, _memory_reservation, cw_log_group_id);
                    else
                        insert into container_definition
                            (name, docker_image, tag, essential, memory_reservation, log_group_id)
                        values
                            (_name, _docker_image, _image_tag, _essential, _memory_reservation, cw_log_group_id);
                    end if;
            
                    select id into c_id
                    from container_definition
                    where name = _name
                    order by id desc
                    limit 1;
            
                    select id into pm_id
                    from port_mapping
                    where container_port = _container_port and host_port = _host_port and protocol = _protocol
                    order by id desc
                    limit 1;
                    
                    if pm_id is null then
                        insert into port_mapping
                            (container_port, host_port, protocol)
                        values
                            (_container_port, _host_port, _protocol);
                        
                        select id into pm_id
                        from port_mapping
                        order by id desc
                        limit 1;
                    end if;

                    insert into container_definition_port_mappings_port_mapping
                        (container_definition_id, port_mapping_id)
                    values
                        (c_id, pm_id);
            
                    for key, val in
                        select *
                        from json_each_text (_environment_variables)
                    loop
                        select id into ev_id
                        from env_variable
                        where name = key and value = val
                        order by id desc
                        limit 1;
            
                        if ev_id is null then
                            insert into env_variable
                                (name, value)
                            values
                                (key, val);
                        
                            select id into ev_id
                            from env_variable
                            order by id desc
                            limit 1;
                        end if;
                        insert into container_definition_environment_env_variable
                            (container_definition_id, env_variable_id)
                        values
                            (c_id, ev_id);
                    end loop;

                    select id into td_id
                    from task_definition
                    where family = _task_definition_family
                    order by revision desc
                    limit 1;

                    insert into task_definition_containers_container_definition
                        (task_definition_id, container_definition_id)
                    values
                        (td_id, c_id);
            
                    raise info 'container_definition_id = %', c_id;
                end;
            $$;
        `);
        // Example of use: call create_task_definition('test-sp', 'arn', 'arn', 'awsvpc', array['FARGATE', 'EXTERNAL']::compatibility_name_enum[], '0.5vCPU-4GB');
        await queryRunner.query(`
            create or replace procedure create_task_definition(
                _family text,
                _task_role_arn text,
                _execution_role_arn text,
                _network_mode task_definition_network_mode_enum,
                _req_compatibilities compatibility_name_enum[],
                _cpu_memory task_definition_cpu_memory_enum
            )
            language plpgsql
            as $$ 
            declare 
                task_definition_id integer;
                rev integer;
                comp record;
            begin
                select revision into rev
                from task_definition
                where family = _family
                order by revision desc
                limit 1;
            
                if rev is null then
                    rev := 1;
                else
                    rev := rev + 1;
                end if;
            
                insert into task_definition
                    (family, revision, task_role_arn, execution_role_arn, network_mode, cpu_memory)
                values
                    (_family, rev, _task_role_arn, _execution_role_arn, _network_mode, _cpu_memory);
            
                select id into task_definition_id
                from task_definition
                order by id desc
                limit 1;
            
                insert into compatibility
                    (name)
                select comp_name
                from (
                    select unnest(_req_compatibilities) as comp_name
                ) as comp_arr
                where not exists (
                    select id from compatibility where name = comp_arr.comp_name
                );
            
                for comp in
                    select id
                    from compatibility
                    where name = any(_req_compatibilities)
                loop
                    insert into task_definition_req_compatibilities_compatibility
                        (task_definition_id, compatibility_id)
                    values
                        (task_definition_id, comp.id);
                end loop;
            
                raise info 'task_definition_id = %', task_definition_id;
            end;
            $$;
        `);
        // Example of use: call create_ecs_service('test-12345', 'iasql', 'postgres:3', 1, 'FARGATE', 'REPLICA', array['subnet-68312820'], array['default'], 'ENABLED', 'iasql-postgresql', 'iasql-postgresql');
        await queryRunner.query(`
            create or replace procedure create_ecs_service(
                _name text,
                _cluster_name text,
                _task_definition_family text,
                _desired_count integer,
                _launch_type service_launch_type_enum,
                _scheduling_strategy service_scheduling_strategy_enum,
                _subnet_ids text[],
                _secutiry_group_names text[],
                _assign_public_ip aws_vpc_conf_assign_public_ip_enum,
                _target_group_name text default null,
                _load_balancer_name text default null
            )
            language plpgsql
            as $$ 
                declare
                    service_id integer;
                    task_def_id integer;
                    sn_id integer;
                    aws_vpc_conf_id integer;
                    cluster_id integer;
                    elb_id integer;
                    target_group_id integer;
                    c_name text;
                    c_port integer;
                    service_load_balancer_id integer;
                    sn record;
                    sg record;
                begin
                    select id into service_id
                    from service
                    where name = _name
                    order by id desc
                    limit 1;
            
                    if service_id is null then
                        select id into sn_id
                        from aws_subnet
                        where subnet_id = any(_subnet_ids)
                        limit 1;
            
                        insert into aws_vpc_conf
                            (assign_public_ip)
                        values
                            (_assign_public_ip);
            
                        select id into aws_vpc_conf_id
                        from aws_vpc_conf
                        order by id desc
                        limit 1;
            
                        for sn in
                            select id
                            from aws_subnet
                            where subnet_id = any(_subnet_ids)
                        loop
                            insert into aws_vpc_conf_subnets_aws_subnet
                                (aws_vpc_conf_id, aws_subnet_id)
                            values
                                (aws_vpc_conf_id, sn.id);
                        end loop;
            
                        for sg in
                            select id
                            from aws_security_group
                            where group_name = any(_secutiry_group_names)
                        loop
                            insert into aws_vpc_conf_security_groups_aws_security_group
                                (aws_vpc_conf_id, aws_security_group_id)
                            values
                                (aws_vpc_conf_id, sg.id);
                        end loop;
            
                        select id into task_def_id
                        from task_definition
                        where family = _task_definition_family
                        order by revision desc
                        limit 1;
            
                        assert task_def_id > 0, 'Task definition not found';
            
                        select id into cluster_id
                        from cluster
                        where cluster_name = _cluster_name
                        limit 1;
            
                        assert cluster_id > 0, 'Cluster not found';
            
                        insert into service
                            (name,cluster_id, task_definition_id, desired_count, launch_type, scheduling_strategy, aws_vpc_conf_id)
                        values
                            (_name, cluster_id, task_def_id, _desired_count, _launch_type, _scheduling_strategy, aws_vpc_conf_id);
            
                        select id into service_id
                        from service
                        order by id desc
                        limit 1;
            
                        select id into elb_id
                        from aws_load_balancer
                        where load_balancer_name = _load_balancer_name
                        limit 1;
            
                        select id into target_group_id
                        from aws_target_group
                        where target_group_name = _target_group_name
                        limit 1;
            
                        select c.name, pm.container_port into c_name, c_port
                        from task_definition td
                            left join task_definition_containers_container_definition tdc on td.id = tdc.task_definition_id
                            left join container_definition c on c.id = tdc.container_definition_id
                            left join container_definition_port_mappings_port_mapping cpm on cpm.container_definition_id = c.id
                            left join port_mapping pm on pm.id = cpm.port_mapping_id
                        where td.id = task_def_id
                        limit 1;
            
                        insert into service_load_balancer
                            (container_name, container_port, target_group_id, elb_id)
                        values
                            (c_name, c_port, target_group_id, elb_id);
            
                        select id into service_load_balancer_id
                        from service_load_balancer
                        order by id desc
                        limit 1;
            
                        insert into service_load_balancers_service_load_balancer
                            (service_id, service_load_balancer_id)
                        values
                            (service_id, service_load_balancer_id);
                    else
                        select id into task_def_id
                        from task_definition
                        where family = _task_definition_family
                        order by revision desc
                        limit 1;

                        update service
                        set task_definition_id = task_def_id
                        where id = service_id;
                    end if;
                    raise info 'service_id = %', service_id;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure create_ecs_service;`);
        await queryRunner.query(`DROP procedure create_task_definition;`);
        await queryRunner.query(`DROP procedure create_container_definition;`);
        await queryRunner.query(`DROP procedure create_ecs_cluster;`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" DROP CONSTRAINT "FK_f19b7360a189526c59b4387a953"`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" DROP CONSTRAINT "FK_0909ccc9eddf3c92a7772912562"`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container_definition" DROP CONSTRAINT "FK_9e80552f2df19a542a657b67595"`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container_definition" DROP CONSTRAINT "FK_b52ff2172cca7171edecacf99c7"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_07133468e6971294c9960d7b25a"`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_env_variable" DROP CONSTRAINT "FK_8bcc496c6c0336cb275758ec97e"`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_env_variable" DROP CONSTRAINT "FK_5db64a61c31484513dd1507099e"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_cf0edf6692e95228082e81bd11b"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_1c9e7dd2ccbf3da95dc83aade5d"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" DROP CONSTRAINT "FK_aac9c17252dad57f56f18df04cb"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" DROP CONSTRAINT "FK_8116cb0c3612c3d1aaffbb86683"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_363118760aef03b1cfe65809a7c"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_fed6565f2a94539d1d57d25f798"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_88e7fb5cc14188b19b08d7e305d"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_de350ceda5a3f4f5f8786518e6f"`);
        await queryRunner.query(`ALTER TABLE "container_definition" DROP CONSTRAINT "FK_c0c1887e471b1f7c33007a2f420"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f19b7360a189526c59b4387a95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0909ccc9eddf3c92a777291256"`);
        await queryRunner.query(`DROP TABLE "task_definition_req_compatibilities_compatibility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e80552f2df19a542a657b6759"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b52ff2172cca7171edecacf99c"`);
        await queryRunner.query(`DROP TABLE "task_definition_containers_container_definition"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6e5bf1aa2a280f96dd7afaf7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07133468e6971294c9960d7b25"`);
        await queryRunner.query(`DROP TABLE "service_load_balancers_service_load_balancer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8bcc496c6c0336cb275758ec97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5db64a61c31484513dd1507099"`);
        await queryRunner.query(`DROP TABLE "container_definition_environment_env_variable"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf0edf6692e95228082e81bd11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c9e7dd2ccbf3da95dc83aade5"`);
        await queryRunner.query(`DROP TABLE "container_definition_port_mappings_port_mapping"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aac9c17252dad57f56f18df04c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8116cb0c3612c3d1aaffbb8668"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_cpu_memory_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_network_mode_enum"`);
        await queryRunner.query(`DROP TABLE "service_load_balancer"`);
        await queryRunner.query(`DROP TABLE "service"`);
        await queryRunner.query(`DROP TYPE "public"."service_scheduling_strategy_enum"`);
        await queryRunner.query(`DROP TYPE "public"."service_launch_type_enum"`);
        await queryRunner.query(`DROP TABLE "container_definition"`);
        await queryRunner.query(`DROP TABLE "port_mapping"`);
        await queryRunner.query(`DROP TYPE "public"."port_mapping_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "env_variable"`);
        await queryRunner.query(`DROP TABLE "compatibility"`);
        await queryRunner.query(`DROP TYPE "public"."compatibility_name_enum"`);
        await queryRunner.query(`DROP TABLE "cluster"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf"`);
        await queryRunner.query(`DROP TYPE "public"."aws_vpc_conf_assign_public_ip_enum"`);
    }

}
