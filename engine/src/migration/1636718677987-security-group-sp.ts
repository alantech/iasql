import { MigrationInterface, QueryRunner } from "typeorm";

export class securityGroupSp1636718677987 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_security_group;`);
    // Example of use: call create_security_group('test', 'test', '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": "8088", "toPort": 8088, "cidrIpv4": "0.0.0.0/0"}]', 'vpc');
    await queryRunner.query(`
      create or replace procedure create_security_group(
        _name text,
        _description text,
        _secutiry_group_rules jsonb default null,
        _vpc_id text default null
      ) 
      language plpgsql
      as $$ 
        declare
          security_group_id integer;
          json_rule jsonb;
        begin
          if _vpc_id is null then
            select vpc_id into _vpc_id
            from vpc
            where is_default = true
            limit 1;
          end if;
      
          select id into security_group_id
          from security_group
          where group_name = _name
          order by id desc
          limit 1;
      
          if security_group_id is null then
            insert into security_group
              (group_name, vpc_id, description)
            values
              (_name, _vpc_id, _description);
      
            select id into security_group_id
            from security_group
            where group_name = _name
            order by id desc
            limit 1;
      
            if jsonb_array_length(_secutiry_group_rules) > 0 then
              for json_rule in
                select * from jsonb_array_elements(_secutiry_group_rules)
              loop
                assert json_rule ?& array['isEgress', 'ipProtocol', 'fromPort', 'toPort', 'cidrIpv4'], 'Not all security group rule required keys are defined ("isEgress", "ipProtocol", "fromPort", "toPort", "cidrIpv4")';
      
                insert into security_group_rule
                  (security_group_id, is_egress, ip_protocol, from_port, to_port, cidr_ipv4)
                values
                  (security_group_id, cast(json_rule ->> 'isEgress' as boolean), json_rule ->> 'ipProtocol', cast(json_rule ->> 'fromPort' as integer), cast(json_rule ->> 'toPort' as integer), cast(json_rule ->> 'cidrIpv4' as cidr));
              end loop;
            end if;
          end if;
      
          raise info 'security_group_id = %', security_group_id;
        end;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP procedure create_security_group;`);
    // Example of use: select * from create_security_group('test', 'test', '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": "8088", "toPort": 8088, "cidrIpv4": "0.0.0.0/0"}]', 'vpc');
    await queryRunner.query(`
      create or replace function create_security_group(
        _name text,
        _description text,
        _secutiry_group_rules jsonb default null,
        _vpc_id text default null
      ) returns integer as $$ 
        declare
          security_group_id integer;
          json_rule jsonb;
        begin
      
        if _vpc_id is null then
          select vpc_id into _vpc_id
          from vpc
          where is_default = true
          limit 1;
        end if;

        insert into security_group
          (
            group_name,
            vpc_id,
            description
          )
        values
          (
            _name,
            _vpc_id,
            _description
          );
      
        select id into security_group_id
        from security_group
        order by id desc
        limit 1;
      
        if jsonb_array_length(_secutiry_group_rules) > 0 then
          for json_rule in
            select * from jsonb_array_elements(_secutiry_group_rules)
          loop
            assert json_rule ?& array['isEgress', 'ipProtocol', 'fromPort', 'toPort', 'cidrIpv4'], 'Not all security group rule required keys are defined ("isEgress", "ipProtocol", "fromPort", "toPort", "cidrIpv4")';
      
            insert into security_group_rule
              (security_group_id, is_egress, ip_protocol, from_port, to_port, cidr_ipv4)
            values
              (security_group_id, cast(json_rule ->> 'isEgress' as boolean), json_rule ->> 'ipProtocol', cast(json_rule ->> 'fromPort' as integer), cast(json_rule ->> 'toPort' as integer), cast(json_rule ->> 'cidrIpv4' as cidr));
          end loop;
        end if;
      
        return security_group_id;
        end; $$ language plpgsql;
    `);
  }

}
