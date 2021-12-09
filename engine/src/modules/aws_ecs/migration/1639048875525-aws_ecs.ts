import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcs1639048875525 implements MigrationInterface {
    name = 'awsEcs1639048875525'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."aws_vpc_conf_assign_public_ip_enum" AS ENUM('DISABLED', 'ENABLED')`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf" ("id" SERIAL NOT NULL, "assign_public_ip" "public"."aws_vpc_conf_assign_public_ip_enum", CONSTRAINT "PK_23873df17bd3e0744254b4ccd9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_45ffb6495d51fdc55df46102ce7" UNIQUE ("cluster_name"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."compatibility_name_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TABLE "compatibility" ("id" SERIAL NOT NULL, "name" "public"."compatibility_name_enum" NOT NULL, CONSTRAINT "UQ_794090c3afd5f43dba2c9fcd631" UNIQUE ("name"), CONSTRAINT "PK_254bde74086e8e3ef50174c3e60" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "env_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_87fd48bd952a768fcf07b9c9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "docker_image" character varying, "tag" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, "cpu" integer, "memory" integer, "memory_reservation" integer, "repository_id" integer, "log_group_id" integer, CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316" UNIQUE ("name"), CONSTRAINT "CHK_4a442d3380af1328ebdd9b4154" CHECK ("docker_image" is not null or "repository_id" is not null), CONSTRAINT "PK_74656f796df3346fa6ec89fa727" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."service_launch_type_enum" AS ENUM('EC2', 'EXTERNAL', 'FARGATE')`);
        await queryRunner.query(`CREATE TYPE "public"."service_scheduling_strategy_enum" AS ENUM('DAEMON', 'REPLICA')`);
        await queryRunner.query(`CREATE TABLE "service" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "status" character varying, "desired_count" integer NOT NULL, "launch_type" "public"."service_launch_type_enum" NOT NULL, "scheduling_strategy" "public"."service_scheduling_strategy_enum" NOT NULL, "cluster_id" integer, "task_definition_id" integer, "aws_vpc_conf_id" integer, CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE ("name"), CONSTRAINT "REL_aeef40fe1f9b32afe23174bb9a" UNIQUE ("aws_vpc_conf_id"), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "service_load_balancer" ("id" SERIAL NOT NULL, "container_name" character varying NOT NULL, "container_port" integer NOT NULL, "target_group_id" integer, "elb_id" integer, CONSTRAINT "PK_4cc8d175d0a19a9109ed66ea512" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_network_mode_enum" AS ENUM('awsvpc', 'bridge', 'host', 'none')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('0.25vCPU-0.5GB', '0.25vCPU-1GB', '0.25vCPU-2GB', '0.5vCPU-1GB', '0.5vCPU-2GB', '0.5vCPU-3GB', '0.5vCPU-4GB', '1vCPU-2GB', '1vCPU-3GB', '1vCPU-4GB', '1vCPU-5GB', '1vCPU-6GB', '1vCPU-7GB', '1vCPU-8GB', '2vCPU-4GB', '2vCPU-5GB', '2vCPU-6GB', '2vCPU-7GB', '2vCPU-8GB', '2vCPU-9GB', '2vCPU-10GB', '2vCPU-11GB', '2vCPU-12GB', '2vCPU-13GB', '2vCPU-14GB', '2vCPU-15GB', '2vCPU-16GB', '4vCPU-8GB', '4vCPU-9GB', '4vCPU-10GB', '4vCPU-11GB', '4vCPU-12GB', '4vCPU-13GB', '4vCPU-14GB', '4vCPU-15GB', '4vCPU-16GB', '4vCPU-17GB', '4vCPU-18GB', '4vCPU-19GB', '4vCPU-20GB', '4vCPU-21GB', '4vCPU-22GB', '4vCPU-23GB', '4vCPU-24GB', '4vCPU-25GB', '4vCPU-26GB', '4vCPU-27GB', '4vCPU-28GB', '4vCPU-29GB', '4vCPU-30GB')`);
        await queryRunner.query(`CREATE TABLE "task_definition" ("id" SERIAL NOT NULL, "task_definition_arn" character varying, "family" character varying NOT NULL, "revision" integer, "task_role_arn" character varying, "execution_role_arn" character varying, "network_mode" "public"."task_definition_network_mode_enum", "status" "public"."task_definition_status_enum", "cpu_memory" "public"."task_definition_cpu_memory_enum", CONSTRAINT "PK_35a67b870f083fc37a99867de7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf_subnets_aws_subnet" ("aws_vpc_conf_id" integer NOT NULL, "aws_subnet_id" integer NOT NULL, CONSTRAINT "PK_91eba2980d920a4ac609a4a466f" PRIMARY KEY ("aws_vpc_conf_id", "aws_subnet_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_818f539e84afc861632a15dfa3" ON "aws_vpc_conf_subnets_aws_subnet" ("aws_vpc_conf_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_57c773d400b4b807bb63e167c5" ON "aws_vpc_conf_subnets_aws_subnet" ("aws_subnet_id") `);
        await queryRunner.query(`CREATE TABLE "aws_vpc_conf_security_groups_aws_security_group" ("aws_vpc_conf_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_381c06538cc2ceecfc32c5d1d0d" PRIMARY KEY ("aws_vpc_conf_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8116cb0c3612c3d1aaffbb8668" ON "aws_vpc_conf_security_groups_aws_security_group" ("aws_vpc_conf_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_aac9c17252dad57f56f18df04c" ON "aws_vpc_conf_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`CREATE TABLE "container_port_mappings_port_mapping" ("container_id" integer NOT NULL, "port_mapping_id" integer NOT NULL, CONSTRAINT "PK_86bba0922c06aa2d94b3c4b6bcb" PRIMARY KEY ("container_id", "port_mapping_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f24b4df268d81f6b0d7332955" ON "container_port_mappings_port_mapping" ("container_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d191532cf18e6888e27a8c13e4" ON "container_port_mappings_port_mapping" ("port_mapping_id") `);
        await queryRunner.query(`CREATE TABLE "container_environment_env_variable" ("container_id" integer NOT NULL, "env_variable_id" integer NOT NULL, CONSTRAINT "PK_b85f80a4400af9ce2478c06baca" PRIMARY KEY ("container_id", "env_variable_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_63d6af02003fa2878f4928aa39" ON "container_environment_env_variable" ("container_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0380f31a79b12d5840246dbfa" ON "container_environment_env_variable" ("env_variable_id") `);
        await queryRunner.query(`CREATE TABLE "service_load_balancers_service_load_balancer" ("service_id" integer NOT NULL, "service_load_balancer_id" integer NOT NULL, CONSTRAINT "PK_76e9299dcd9aa45dc8838447d6d" PRIMARY KEY ("service_id", "service_load_balancer_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_07133468e6971294c9960d7b25" ON "service_load_balancers_service_load_balancer" ("service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6e5bf1aa2a280f96dd7afaf7e" ON "service_load_balancers_service_load_balancer" ("service_load_balancer_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_containers_container" ("task_definition_id" integer NOT NULL, "container_id" integer NOT NULL, CONSTRAINT "PK_0f4d88ef28c8dd5c832f6b59455" PRIMARY KEY ("task_definition_id", "container_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_150cf61597f886a39e6c4a60e3" ON "task_definition_containers_container" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8645e90b3981ca6e9e5e3c213b" ON "task_definition_containers_container" ("container_id") `);
        await queryRunner.query(`CREATE TABLE "task_definition_req_compatibilities_compatibility" ("task_definition_id" integer NOT NULL, "compatibility_id" integer NOT NULL, CONSTRAINT "PK_baf64abcea837eac4b5a95a63d9" PRIMARY KEY ("task_definition_id", "compatibility_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0909ccc9eddf3c92a777291256" ON "task_definition_req_compatibilities_compatibility" ("task_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f19b7360a189526c59b4387a95" ON "task_definition_req_compatibilities_compatibility" ("compatibility_id") `);
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "FK_50a8e46cefb58596f984657aa54" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "FK_8c282c3d4495a970477de88bf44" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7" FOREIGN KEY ("cluster_id") REFERENCES "cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_fed6565f2a94539d1d57d25f798" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_363118760aef03b1cfe65809a7c" FOREIGN KEY ("elb_id") REFERENCES "aws_load_balancer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_aws_subnet" ADD CONSTRAINT "FK_818f539e84afc861632a15dfa3e" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_aws_subnet" ADD CONSTRAINT "FK_57c773d400b4b807bb63e167c57" FOREIGN KEY ("aws_subnet_id") REFERENCES "aws_subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" ADD CONSTRAINT "FK_8116cb0c3612c3d1aaffbb86683" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" ADD CONSTRAINT "FK_aac9c17252dad57f56f18df04cb" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" ADD CONSTRAINT "FK_4f24b4df268d81f6b0d73329557" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" ADD CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d" FOREIGN KEY ("port_mapping_id") REFERENCES "port_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" ADD CONSTRAINT "FK_63d6af02003fa2878f4928aa39d" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" ADD CONSTRAINT "FK_d0380f31a79b12d5840246dbfa6" FOREIGN KEY ("env_variable_id") REFERENCES "env_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_07133468e6971294c9960d7b25a" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec" FOREIGN KEY ("service_load_balancer_id") REFERENCES "service_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" ADD CONSTRAINT "FK_150cf61597f886a39e6c4a60e3a" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" ADD CONSTRAINT "FK_8645e90b3981ca6e9e5e3c213b2" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_0909ccc9eddf3c92a7772912562" FOREIGN KEY ("task_definition_id") REFERENCES "task_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_definition_req_compatibilities_compatibility" ADD CONSTRAINT "FK_f19b7360a189526c59b4387a953" FOREIGN KEY ("compatibility_id") REFERENCES "compatibility"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
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
        // docker image: call create_container_definition('test-sp', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_docker_image := 'postgres');
        // ecr repository: call create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_ecr_repository_name := 'test2');
        // error example: call create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4');
        await queryRunner.query(`
            create or replace procedure create_container_definition(
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
                    cw_log_group_id integer;
                begin
            
                    assert (_docker_image is null and _ecr_repository_name is not null) or (_docker_image is not null and _ecr_repository_name is null), '_docker_image or _ecr_repository_name need to be defined';
            
                    select id into cw_log_group_id
                    from log_group
                    where log_group_name = _cloud_watch_log_group
                    limit 1;

                    if _ecr_repository_name is not null then
                        select id into ecr_repository_id
                        from aws_repository
                        where repository_name = _ecr_repository_name
                        limit 1;
            
                        insert into container
                            (name, repository_id, tag, essential, memory_reservation, log_group_id)
                        values
                            (_name, ecr_repository_id, _image_tag, _essential, _memory_reservation, cw_log_group_id)
                        on conflict (name)
                        do update set repository_id = ecr_repository_id, tag = _image_tag, essential = _essential, memory_reservation = _memory_reservation;
                    else
                        insert into container
                            (name, docker_image, tag, essential, memory_reservation, log_group_id)
                        values
                            (_name, _docker_image, _image_tag, _essential, _memory_reservation, cw_log_group_id)
                        on conflict (name)
                        do update set docker_image = _docker_image, tag = _image_tag, essential = _essential, memory_reservation = _memory_reservation;
                    end if;
            
                    select id into c_id
                    from container
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
                        
                        insert into container_port_mappings_port_mapping
                            (container_id, port_mapping_id)
                        values
                            (c_id, pm_id);
                    end if;
            
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
                        
                            insert into container_environment_env_variable
                                (container_id, env_variable_id)
                            values
                                (c_id, ev_id);
                        end if;
                    end loop;
            
                    raise info 'container_id = %', c_id;
                end;
            $$;
        `);
        // Example of use: call create_task_definition('test-sp', 'arn', 'arn', 'awsvpc', array['FARGATE', 'EXTERNAL']::compatibility_name_enum[], '0.5vCPU-4GB', array['postgresql']);
        await queryRunner.query(`
            create or replace procedure create_task_definition(
                _family text,
                _task_role_arn text,
                _execution_role_arn text,
                _network_mode task_definition_network_mode_enum,
                _req_compatibilities compatibility_name_enum[],
                _cpu_memory task_definition_cpu_memory_enum,
                _container_definition_names text[]
            )
            language plpgsql
            as $$ 
            declare 
                task_definition_id integer;
                rev integer;
                comp record;
                cont record;
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
            
                for cont in
                    select id
                    from container
                    where name = any(_container_definition_names)
                loop
                    insert into task_definition_containers_container
                        (task_definition_id, container_id)
                    values
                        (task_definition_id, cont.id);
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
                            left join task_definition_containers_container tdc on td.id = tdc.task_definition_id
                            left join container c on c.id = tdc.container_id
                            left join container_port_mappings_port_mapping cpm on cpm.container_id = c.id
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
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" DROP CONSTRAINT "FK_8645e90b3981ca6e9e5e3c213b2"`);
        await queryRunner.query(`ALTER TABLE "task_definition_containers_container" DROP CONSTRAINT "FK_150cf61597f886a39e6c4a60e3a"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_07133468e6971294c9960d7b25a"`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" DROP CONSTRAINT "FK_d0380f31a79b12d5840246dbfa6"`);
        await queryRunner.query(`ALTER TABLE "container_environment_env_variable" DROP CONSTRAINT "FK_63d6af02003fa2878f4928aa39d"`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" DROP CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d"`);
        await queryRunner.query(`ALTER TABLE "container_port_mappings_port_mapping" DROP CONSTRAINT "FK_4f24b4df268d81f6b0d73329557"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" DROP CONSTRAINT "FK_aac9c17252dad57f56f18df04cb"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_security_groups_aws_security_group" DROP CONSTRAINT "FK_8116cb0c3612c3d1aaffbb86683"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_aws_subnet" DROP CONSTRAINT "FK_57c773d400b4b807bb63e167c57"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf_subnets_aws_subnet" DROP CONSTRAINT "FK_818f539e84afc861632a15dfa3e"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_363118760aef03b1cfe65809a7c"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_fed6565f2a94539d1d57d25f798"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_4518e1b3072a8f68c3bc747338e"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_b1570c701dd1adce1391f2f25e7"`);
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "FK_8c282c3d4495a970477de88bf44"`);
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "FK_50a8e46cefb58596f984657aa54"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f19b7360a189526c59b4387a95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0909ccc9eddf3c92a777291256"`);
        await queryRunner.query(`DROP TABLE "task_definition_req_compatibilities_compatibility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8645e90b3981ca6e9e5e3c213b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_150cf61597f886a39e6c4a60e3"`);
        await queryRunner.query(`DROP TABLE "task_definition_containers_container"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6e5bf1aa2a280f96dd7afaf7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07133468e6971294c9960d7b25"`);
        await queryRunner.query(`DROP TABLE "service_load_balancers_service_load_balancer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0380f31a79b12d5840246dbfa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63d6af02003fa2878f4928aa39"`);
        await queryRunner.query(`DROP TABLE "container_environment_env_variable"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d191532cf18e6888e27a8c13e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f24b4df268d81f6b0d7332955"`);
        await queryRunner.query(`DROP TABLE "container_port_mappings_port_mapping"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aac9c17252dad57f56f18df04c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8116cb0c3612c3d1aaffbb8668"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_57c773d400b4b807bb63e167c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_818f539e84afc861632a15dfa3"`);
        await queryRunner.query(`DROP TABLE "aws_vpc_conf_subnets_aws_subnet"`);
        await queryRunner.query(`DROP TABLE "task_definition"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_cpu_memory_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_network_mode_enum"`);
        await queryRunner.query(`DROP TABLE "service_load_balancer"`);
        await queryRunner.query(`DROP TABLE "service"`);
        await queryRunner.query(`DROP TYPE "public"."service_scheduling_strategy_enum"`);
        await queryRunner.query(`DROP TYPE "public"."service_launch_type_enum"`);
        await queryRunner.query(`DROP TABLE "container"`);
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
