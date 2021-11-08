import { MigrationInterface, QueryRunner } from "typeorm";

export class updateEcsServiceSp1636377039788 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Need to drop first since we are modifiying funtion parameters. Otherwise will not be necessary to drop.
    await queryRunner.query(`DROP function create_ecs_service;`);
    // Example of use: select * from create_ecs_service('test-12345', 'iasql', 'postgres', '3', 1, 'FARGATE', 'REPLICA', array['subnet-68312820'], array['default'], 'ENABLED', 'iasql-postgresql', 'iasql-postgresql');
    await queryRunner.query(`
      create or replace function create_ecs_service(
        _name text,
        _cluster_name text,
        _task_definition_family text,
        _task_definition_revision integer,
        _desired_count integer,
        _launch_type service_launch_type_enum,
        _scheduling_strategy service_scheduling_strategy_enum,
        _subnet_ids text[],
        _secutiry_group_names text[],
        _assign_public_ip aws_vpc_conf_assign_public_ip_enum,
        _target_group_name text default null,
        _load_balancer_name text default null
      ) returns integer as $$ 
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
      
        select id into sn_id
        from subnet
        where subnet_id = any(_subnet_ids)
        limit 1;
      
        insert into aws_vpc_conf
          (
            subnet_id,
            assign_public_ip
          )
        values
          (
            sn_id,
            _assign_public_ip
          );
      
        select id into aws_vpc_conf_id
        from aws_vpc_conf
        order by id desc
        limit 1;
      
        for sn in
          select id
          from subnet
          where
            subnet_id = any(_subnet_ids)
        loop
          insert into aws_vpc_conf_subnets_subnet
            (aws_vpc_conf_id, subnet_id)
          values
            (aws_vpc_conf_id, sn.id);
        end loop;
      
        for sg in
          select id
          from security_group
          where
            group_name = any(_secutiry_group_names)
        loop
          insert into aws_vpc_conf_security_groups_security_group
            (aws_vpc_conf_id, security_group_id)
          values
            (aws_vpc_conf_id, sg.id);
        end loop;
      
        select id into task_def_id
        from task_definition
        where family = _task_definition_family and revision = _task_definition_revision
        limit 1;
      
        assert task_def_id > 0, 'Task definition not found';

        select id into cluster_id
        from cluster
        where name = _cluster_name
        limit 1;

        assert cluster_id > 0, 'Cluster not found';

        insert into service
          (
            name,
            cluster_id,
            task_definition_id,
            desired_count,
            launch_type,
            scheduling_strategy,
            aws_vpc_conf_id
          )
        values
          (
            _name,
            cluster_id,
            task_def_id,
            _desired_count,
            _launch_type,
            _scheduling_strategy,
            aws_vpc_conf_id
          );
      
        select id into service_id
        from service
        order by id desc
        limit 1;

        select id into elb_id
        from elb
        where load_balancer_name = _load_balancer_name
        limit 1;

        select id into target_group_id
        from target_group
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

        return service_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecs_service;`);
    // Example of use: select * from create_ecs_service('test-12345', 'iasql', 'postgres:3', 1, 'FARGATE', 'REPLICA', array['subnet-68312820'], array['default'], 'ENABLED', 'iasql-postgresql', 'iasql-postgresql');
    await queryRunner.query(`
      create or replace function create_ecs_service(
        _name text,
        _cluster_name text,
        _task_definition text,
        _desired_count integer,
        _launch_type service_launch_type_enum,
        _scheduling_strategy service_scheduling_strategy_enum,
        _subnet_ids text[],
        _secutiry_group_names text[],
        _assign_public_ip aws_vpc_conf_assign_public_ip_enum,
        _target_group_name text default null,
        _load_balancer_name text default null
      ) returns integer as $$ 
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
      
        select id into sn_id
        from subnet
        where subnet_id = any(_subnet_ids)
        limit 1;
      
        insert into aws_vpc_conf
          (
            subnet_id,
            assign_public_ip
          )
        values
          (
            sn_id,
            _assign_public_ip
          );
      
        select id into aws_vpc_conf_id
        from aws_vpc_conf
        order by id desc
        limit 1;
      
        for sn in
          select id
          from subnet
          where
            subnet_id = any(_subnet_ids)
        loop
          insert into aws_vpc_conf_subnets_subnet
            (aws_vpc_conf_id, subnet_id)
          values
            (aws_vpc_conf_id, sn.id);
        end loop;
      
        for sg in
          select id
          from security_group
          where
            group_name = any(_secutiry_group_names)
        loop
          insert into aws_vpc_conf_security_groups_security_group
            (aws_vpc_conf_id, security_group_id)
          values
            (aws_vpc_conf_id, sg.id);
        end loop;
      
        select id into task_def_id
        from task_definition
        where family_revision = _task_definition
        limit 1;
      
        assert task_def_id > 0, 'Task definition not found';

        select id into cluster_id
        from cluster
        where name = _cluster_name
        limit 1;

        assert cluster_id > 0, 'Cluster not found';

        insert into service
          (
            name,
            cluster_id,
            task_definition_id,
            desired_count,
            launch_type,
            scheduling_strategy,
            aws_vpc_conf_id
          )
        values
          (
            _name,
            cluster_id,
            task_def_id,
            _desired_count,
            _launch_type,
            _scheduling_strategy,
            aws_vpc_conf_id
          );
      
        select id into service_id
        from service
        order by id desc
        limit 1;

        select id into elb_id
        from elb
        where load_balancer_name = _load_balancer_name
        limit 1;

        select id into target_group_id
        from target_group
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

        return service_id;
        end; $$ language plpgsql;
    `);
  }

}
