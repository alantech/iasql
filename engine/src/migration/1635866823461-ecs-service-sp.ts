import { MigrationInterface, QueryRunner } from "typeorm";

export class ecsServiceSp1635866823461 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_ecs_service('test-sp', 'test-sp', 'test-sp:1', 1, 'FARGATE', 'REPLICA', array['subnet-68312820'], array['default'], 'ENABLED');
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
        _assign_public_ip aws_vpc_conf_assign_public_ip_enum
      ) returns integer as $$ 
        declare 
          service_id integer;
          task_definition_id integer;
          sn_id integer;
          aws_vpc_conf_id integer;
          cluster_id integer;
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
      
        select id into task_definition_id
        from task_definition
        where family_revision = _task_definition
        limit 1;
      
        assert task_definition_id > 0, 'Task definition not found';

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
            task_definition_id,
            _desired_count,
            _launch_type,
            _scheduling_strategy,
            aws_vpc_conf_id
          );
      
        select id into service_id
        from cluster
        order by id desc
        limit 1;
      
        return service_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecs_service;`);
  }

}
