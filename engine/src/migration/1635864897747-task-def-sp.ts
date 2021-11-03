import { MigrationInterface, QueryRunner } from "typeorm";

export class taskDefSp1635864897747 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_task_definition('test-sp', 1, 'arn', 'arn', 'awsvpc', array['FARGATE', 'EXTERNAL']::compatibility_name_enum[], '0.5vCPU-4GB', array[1,3]);
    await queryRunner.query(`
      create or replace function create_task_definition(
        _family text,
        _revision integer,
        _task_role_arn text,
        _execution_role_arn text,
        _network_mode task_definition_network_mode_enum,
        _req_compatibilities compatibility_name_enum[],
        _cpu_memory task_definition_cpu_memory_enum,
        _container_definition_ids integer[]
      ) returns integer as $$ 
        declare 
          task_definition_id integer;
          comp record;
          cont record;
        begin
      
        insert into task_definition
          (
            family,
            revision,
            family_revision,
            task_role_arn,
            execution_role_arn,
            network_mode,
            cpu_memory
          )
        values
          (
            _family,
            _revision,
            concat(_family, ':', _revision),
            _task_role_arn,
            _execution_role_arn,
            _network_mode,
            _cpu_memory
          );
      
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
          where id = any(_container_definition_ids)
        loop
          insert into task_definition_containers_container
            (task_definition_id, container_id)
          values
            (task_definition_id, cont.id);
        end loop;
      
        return task_definition_id;
        end; $$ language plpgsql;
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_task_definition;`);
  }

}
