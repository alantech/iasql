import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcsFargate1646681056355 implements MigrationInterface {
    name = 'awsEcsFargate1646681056355'

    public async up(queryRunner: QueryRunner): Promise<void> {
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
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab" FOREIGN KEY ("cluster_id") REFERENCES "aws_cluster"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service" ADD CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a" FOREIGN KEY ("target_group_id") REFERENCES "aws_target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd" FOREIGN KEY ("task_definition_id") REFERENCES "aws_task_definition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_22ad0cd60293360bdc81fe67426" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5" FOREIGN KEY ("public_repository_id") REFERENCES "aws_public_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" ADD CONSTRAINT "FK_535959b3981bc7f5351dd539c7a" FOREIGN KEY ("log_group_id") REFERENCES "log_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_f67477ae38456964fdd0084f735" FOREIGN KEY ("aws_service_id") REFERENCES "aws_service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" ADD CONSTRAINT "FK_c011c527aec5c6020fc1484bb10" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`
            create or replace procedure create_or_update_ecs_cluster(_name text)
            language plpgsql
            as $$
            declare 
                cluster_id integer;
            begin
                insert into aws_cluster
                    (cluster_name)
                values
                    (_name)
                on conflict (cluster_name)
                do nothing;
            
                select id into cluster_id
                from aws_cluster
                where cluster_name = _name
                order by id desc
                limit 1;
            
                raise info 'cluster_id = %', cluster_id;
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace procedure create_task_definition(
                _family text,
                _task_role_arn text,
                _execution_role_arn text,
                _cpu_memory aws_task_definition_cpu_memory_enum
            )
            language plpgsql
            as $$ 
            declare 
                task_definition_id integer;
                rev integer;
            begin
                select revision into rev
                from aws_task_definition
                where family = _family
                order by revision desc
                limit 1;
            
                if rev is null then
                    rev := 1;
                else
                    rev := rev + 1;
                end if;
            
                insert into aws_task_definition
                    (family, revision, task_role_arn, execution_role_arn, cpu_memory)
                values
                    (_family, rev, _task_role_arn, _execution_role_arn, _cpu_memory);
            
                select id into task_definition_id
                from aws_task_definition
                order by id desc
                limit 1;
            
                raise info 'task_definition_id = %', task_definition_id;
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace procedure create_container_definition(
                _name text,
                _task_definition_family text,
                _essential boolean,
                _memory_reservation integer,
                _container_port integer,
                _host_port integer,
                _protocol aws_container_definition_protocol_enum,
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
                    assert (_environment_variables is null) or (_environment_variables is not null and json_typeof(_environment_variables) = 'object'), 'Invalid environment variable format. Should be an object with format { [key: string]: string } ';

                    select id into cw_log_group_id
                    from log_group
                    where log_group_name = _cloud_watch_log_group
                    limit 1;

                    select id into td_id
                    from aws_task_definition
                    where family = _task_definition_family
                    order by revision desc
                    limit 1;

                    if _ecr_repository_name is not null then
                        select id into ecr_repository_id
                        from aws_repository
                        where repository_name = _ecr_repository_name
                        limit 1;
            
                        insert into aws_container_definition
                            (name, task_definition_id, repository_id, tag, essential, memory_reservation, log_group_id, host_port, container_port, protocol, env_variables)
                        values
                            (_name, td_id, ecr_repository_id, _image_tag, _essential, _memory_reservation, cw_log_group_id, _host_port, _container_port, _protocol, _environment_variables);
                    elsif _ecr_public_repository_name is not null then
                        select id into ecr_public_repository_id
                        from aws_public_repository
                        where repository_name = _ecr_public_repository_name
                        limit 1;
            
                        insert into aws_container_definition
                            (name, task_definition_id, public_repository_id, tag, essential, memory_reservation, log_group_id, host_port, container_port, protocol, env_variables)
                        values
                            (_name, td_id, ecr_public_repository_id, _image_tag, _essential, _memory_reservation, cw_log_group_id, _host_port, _container_port, _protocol, _environment_variables);
                    else
                        insert into aws_container_definition
                            (name, task_definition_id, docker_image, tag, essential, memory_reservation, log_group_id, host_port, container_port, protocol, env_variables)
                        values
                            (_name, td_id, _docker_image, _image_tag, _essential, _memory_reservation, cw_log_group_id, _host_port, _container_port, _protocol, _environment_variables);
                    end if;

                    select id into c_id
                    from aws_container_definition
                    where name = _name
                    order by id desc
                    limit 1;

                    raise info 'container_definition_id = %', c_id;
                end;
            $$;
        `);
        await queryRunner.query(`
            create or replace procedure create_or_update_ecs_service(
                _name text,
                _cluster_name text,
                _task_definition_family text,
                _desired_count integer,
                _security_group_names text[],
                _assign_public_ip aws_service_assign_public_ip_enum,
                _subnet_ids text[] default null,
                _target_group_name text default null
            )
            language plpgsql
            as $$ 
                declare
                    service_id integer;
                    task_def_id integer;
                    avc_id integer;
                    cluster_id integer;
                    elb_id integer;
                    target_group_id integer;
                    c_name text;
                    c_port integer;
                    service_load_balancer_id integer;
                    sg record;
                begin
                    INSERT INTO aws_service
                        ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
                    VALUES
                        (_name, _desired_count, _subnet_ids, _assign_public_ip, (select id from aws_cluster where cluster_name = _cluster_name), (select id from aws_task_definition where family = _task_definition_family order by revision desc limit 1), (select id from aws_target_group where target_group_name = _target_group_name limit 1))
                    ON CONFLICT (name)
                    DO UPDATE SET desired_count = _desired_count,
                        subnets = _subnet_ids,
                        assign_public_ip = _assign_public_ip,
                        cluster_id = (select id from aws_cluster where cluster_name = _cluster_name),
                        task_definition_id = (select id from aws_task_definition where family = _task_definition_family order by revision desc limit 1),
                        target_group_id = (select id from aws_target_group where target_group_name = _target_group_name limit 1);

                    select id into service_id
                    from aws_service
                    where name = _name
                    order by id desc
                    limit 1;

                    for sg in
                        select id
                        from aws_security_group
                        where group_name = any(_security_group_names)
                    loop
                        insert into aws_service_security_groups
                            (aws_service_id, aws_security_group_id)
                        values
                            (service_id, sg.id)
                        on conflict do nothing;
                    end loop;

                    delete from aws_service_security_groups
                    using aws_security_group
                    where aws_service_security_groups.aws_service_id = service_id and 
                        aws_security_group.id = aws_service_security_groups.aws_security_group_id and
                        not (group_name = any(_security_group_names));
                    
                    raise info 'service_id = %', service_id;
                end;
            $$;
        `);
        // Example of use: call delete_ecs_cluster('test-sp');
        await queryRunner.query(`
            create or replace procedure delete_ecs_cluster(_name text)
            language plpgsql
            as $$
            begin
                delete from aws_cluster
                where cluster_name = _name;
            end;
            $$;
        `);
        // Example of use:
        // ecr repository: call delete_container_definition('test-sp2', 'task-test-sp', 3);
        await queryRunner.query(`
            create or replace procedure delete_container_definition(
                _name text,
                _task_definition_family text,
                _task_definition_revision integer default null
            )
            language plpgsql
            as $$
                declare
                    c_id integer[];
                    pm_id integer[];
                    key text;
                    val text;
                    ev_id integer;
                    ecr_repository_id integer;
                    ecr_public_repository_id integer;
                    cw_log_group_id integer;
                    td_id integer[];
                begin
                    if _task_definition_revision is null then
                        select array(
                            select id
                            from aws_task_definition
                            where family = _task_definition_family
                        ) into td_id;
                    else
                        select array(
                            select id
                            from aws_task_definition
                            where family = _task_definition_family and revision = _task_definition_revision
                            order by revision desc
                            limit 1
                        ) into td_id;
                    end if;
                    
                    select array(
                        select aws_container_definition.id
                        from aws_container_definition
                        inner join aws_task_definition on aws_task_definition.id = aws_container_definition.task_definition_id
                        where aws_container_definition.task_definition_id = any(td_id)
                    ) into c_id;
                    
                    delete from aws_container_definition
                    where id = any(c_id);
                end;
            $$;
        `);
        // Example of use: call delete_task_definition('test-sp', 3);
        await queryRunner.query(`
            create or replace procedure delete_task_definition(_family text, _revision integer default null)
            language plpgsql
            as $$ 
                declare 
                    task_def_id integer[];
                begin
                    if _revision is null then
                        select array(
                            select id
                            from aws_task_definition
                            where family = _family
                        ) into task_def_id;
                    else
                        select array(
                            select id
                            from aws_task_definition
                            where family = _family and revision = _revision
                            order by id, revision desc
                            limit 1
                        ) into task_def_id;
                    end if;
                    
                    delete
                    from aws_task_definition
                    where id = any(task_def_id);
                end;
            $$;
        `);
        // Example of use: call delete_ecs_service('test-12345');
        await queryRunner.query(`
            create or replace procedure delete_ecs_service(_name text)
            language plpgsql
            as $$ 
                declare
                    serv_id integer;
                    task_def_id integer;
                    aws_vpc_c_id integer;
                    cluster_id integer;
                    elb_id integer;
                    target_group_id integer;
                    c_name text;
                    c_port integer;
                    serv_load_balancer_id integer;
                    sg record;
                begin
                    select id into serv_id
                    from aws_service
                    where name = _name
                    order by id desc
                    limit 1;

                    delete from aws_service_security_groups
                    where aws_service_id = serv_id;
                    
                    delete from aws_service
                    where id = serv_id;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure delete_ecs_service;`);
        await queryRunner.query(`DROP procedure delete_task_definition;`);
        await queryRunner.query(`DROP procedure delete_container_definition;`);
        await queryRunner.query(`DROP procedure delete_ecs_cluster;`);
        await queryRunner.query(`DROP procedure create_or_update_ecs_service;`);
        await queryRunner.query(`DROP procedure create_task_definition;`);
        await queryRunner.query(`DROP procedure create_container_definition;`);
        await queryRunner.query(`DROP procedure create_or_update_ecs_cluster;`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_c011c527aec5c6020fc1484bb10"`);
        await queryRunner.query(`ALTER TABLE "aws_service_security_groups" DROP CONSTRAINT "FK_f67477ae38456964fdd0084f735"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_535959b3981bc7f5351dd539c7a"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_753af3f8c3a57a0b09788a3abf5"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_22ad0cd60293360bdc81fe67426"`);
        await queryRunner.query(`ALTER TABLE "aws_container_definition" DROP CONSTRAINT "FK_177d0a2c83773e2765e65c98bfd"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_9f6e9a39f872c7186038fb5dc5a"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_c2eb40c50f359cad97ee103d2b1"`);
        await queryRunner.query(`ALTER TABLE "aws_service" DROP CONSTRAINT "FK_a91ca2a69364714dbf08c5f25ab"`);
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
    }

}
