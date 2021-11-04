import { MigrationInterface, QueryRunner } from "typeorm";

export class securityGroupSp1636018981627 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_security_group('test', 'test', 'test', '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": "8088", "toPort": 8088, "cidrIpv4": "0.0.0.0/0"}]');
    await queryRunner.query(`
      create or replace function create_security_group(
        _name text,
        _description text,
        _vpc_id text,
        _secutiry_group_rules jsonb default null
      ) returns integer as $$ 
        declare
          security_group_id integer;
          json_rule jsonb;
        begin
      
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_security_group;`);
  }

}
