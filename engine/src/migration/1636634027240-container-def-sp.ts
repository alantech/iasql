import { MigrationInterface, QueryRunner } from "typeorm";

export class containerDefSp1636634027240 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop function create_container_definition;`);
    // Example of use:
    // call create_container_definition('test-sp', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_docker_image := 'postgres');
    // call create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_ecr_repository_name := 'test2');
    // call create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4');
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
        _ecr_repository_name text default null
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
        begin
      
          assert (_docker_image is null and _ecr_repository_name is not null) or (_docker_image is not null and _ecr_repository_name is null), '_docker_image or _ecr_repository_name need to be defined';
      
          if _ecr_repository_name is not null then
            select id into ecr_repository_id
            from repository
            where repository_name = _ecr_repository_name
            limit 1;
      
            insert into container
              (name, repository_id, tag, essential, memory_reservation)
            values
              (_name, ecr_repository_id, _image_tag, _essential, _memory_reservation)
            on conflict (name)
            do nothing;
          else
            insert into container
              (name, docker_image, tag, essential, memory_reservation)
            values
              (_name, _docker_image, _image_tag, _essential, _memory_reservation)
            on conflict (name)
            do nothing;
          end if;
      
          select id into c_id
          from container
          where name = _name
          order by id desc
          limit 1;
      
          select port_mapping_id into pm_id
          from container_port_mappings_port_mapping
          where container_id = c_id
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
      
          select env_variable_id into ev_id
          from container_environment_env_variable
          where container_id = c_id
          limit 1;
          
          if ev_id is null then
            for key, val in
              select *
              from json_each_text (_environment_variables)
            loop
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
            end loop;
          end if;
      
          raise info 'container_id = %', c_id;
        end;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop procedure create_container_definition;`);
    // Example of use:
    // select * from create_container_definition('test-sp', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_docker_image := 'postgres');
    // select * from create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4',_ecr_repository_name := 'test2');
    // select * from create_container_definition('test-sp2', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}', '13.4');
    await queryRunner.query(`
      create or replace function create_container_definition(
        _name text,
        _essential boolean,
        _memory_reservation integer,
        _host_port integer,
        _container_port integer,
        _protocol port_mapping_protocol_enum,
        _environment_variables json,
        _image_tag text,
        _docker_image text default null,
        _ecr_repository_name text default null
      ) returns integer as $$ 
        declare 
          container_id integer;
          port_mapping_id integer;
          key text;
          val text;
          env_var_id integer;
          ecr_repository_id integer;
        begin

        assert (_docker_image is null and _ecr_repository_name is not null) or (_docker_image is not null and _ecr_repository_name is null), '_docker_image or _ecr_repository_name need to be defined';

        if _ecr_repository_name is not null then
          select id into ecr_repository_id
          from repository
          where repository_name = _ecr_repository_name
          limit 1;

          insert into container
            (
              name,
              repository_id,
              tag,
              essential,
              memory_reservation
            )
          values
            (
              _name,
              ecr_repository_id,
              _image_tag,
              _essential,
              _memory_reservation
            );
        else
          insert into container
            (
              name,
              docker_image,
              tag,
              essential,
              memory_reservation
            )
          values
            (
              _name,
              _docker_image,
              _image_tag,
              _essential,
              _memory_reservation
            );
        end if;
      
        select id into container_id
        from container
        order by id desc
        limit 1;
      
        insert into port_mapping
          (
            container_port,
            host_port,
            protocol
          )
        values
          (
            _container_port,
            _host_port,
            _protocol
          );
      
        select id into port_mapping_id
        from port_mapping
        order by id desc
        limit 1;
      
        insert into container_port_mappings_port_mapping
          (
            container_id,
            port_mapping_id
          )
        values
          (
            container_id,
            port_mapping_id
          );
      
        for key, val in
          select *
          from json_each_text (_environment_variables)
        loop
          insert into env_variable
            (name, value)
          values
            (key, val);
      
          select id into env_var_id
          from env_variable
          order by id desc
          limit 1;
      
          insert into container_environment_env_variable
            (
              container_id,
              env_variable_id
            )
          values
            (
              container_id,
              env_var_id
            );
        end loop;
      
        return container_id;
        end; $$ language plpgsql;
    `);
  }

}
