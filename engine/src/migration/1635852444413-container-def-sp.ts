import { MigrationInterface, QueryRunner } from "typeorm";

export class containerDefSp1635852444413 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_container_definition('test-sp', 'image', false, 4096, 8080, 8080, 'tcp', '{"a": "123", "b": 456}');
    await queryRunner.query(`
      create or replace function create_container_definition(
        _name text,
        _image text,
        _essential boolean,
        _memory_reservation integer,
        _host_port integer,
        _container_port integer,
        _protocol port_mapping_protocol_enum,
        _environment_variables json
      ) returns integer as $$ 
        declare 
          container_id integer;
          port_mapping_id integer;
          key text;
          val text;
          env_var_id integer;
        begin
      
        insert into container
          (
            name,
            image,
            essential,
            memory_reservation
          )
        values
          (
            _name,
            _image,
            _essential,
            _memory_reservation
          );
      
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_container_definition;`);
  }

}
