import { MigrationInterface, QueryRunner } from "typeorm";

export class targetGroupSp1636655461356 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_target_group('test-sp', 'ip', 8888, 'vpc-41895538', 'TCP');
    await queryRunner.query(`
      create or replace function create_target_group(
        _name text,
        _target_type target_group_target_type_enum,
        _port integer,
        _vpc_id text,
        _protocol target_group_protocol_enum
      ) returns integer as $$ 
        declare 
          tg_vpc_id integer;
          target_group_id integer;
        begin
        select id into tg_vpc_id
        from vpc
        where
          vpc_id = _vpc_id
        order by id desc
        limit 1;
      
        insert into target_group
          (
            target_group_name,
            target_type,
            protocol,
            port,
            vpc_id
          )
        values
          (
            _name,
            _target_type,
            _protocol,
            _port,
            tg_vpc_id
          )
        on conflict (target_group_name)
        do nothing;
      
        select id into target_group_id
        from target_group
        where target_group_name = _name
        order by id desc
        limit 1;
      
        return target_group_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_target_group('test-sp', 'ip', 8888, 'vpc-41895538', 'TCP');
    await queryRunner.query(`
      create or replace function create_target_group(
        _name text,
        _target_type target_group_target_type_enum,
        _port integer,
        _vpc_id text,
        _protocol target_group_protocol_enum
      ) returns integer as $$ 
        declare 
          tg_vpc_id integer;
          target_group_id integer;
        begin
        select id into tg_vpc_id
        from vpc
        where
          vpc_id = _vpc_id
        order by id desc
        limit 1;
      
        insert into target_group
          (
            target_group_name,
            target_type,
            protocol,
            port,
            vpc_id
          )
        values
          (
            _name,
            _target_type,
            _protocol,
            _port,
            tg_vpc_id
          );
      
        select id into target_group_id
        from target_group
        order by id desc
        limit 1;
      
        return target_group_id;
        end; $$ language plpgsql;
    `);
  }

}
