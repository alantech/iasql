import { MigrationInterface, QueryRunner } from "typeorm";

export class elbSp1635764643692 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_load_balancer('test-sp2', 'internal', 'vpc-41895538', 'network', array['subnet-68312820', 'subnet-a58a84c3'], 'ipv4');
    await queryRunner.query(`
      create or replace function create_load_balancer(
        _name text,
        _scheme elb_scheme_enum,
        _vpc_id text,
        _elb_type elb_elb_type_enum,
        _subnet_ids text [],
        _ip_address_type elb_ip_address_type_enum,
        _security_group_names text [] default null
      ) returns integer as $$
        declare
          elb_vpc_id integer;
          aux_az_id integer;
          az record;
          sn record;
          sg record;
          load_balancer_id integer;
        begin
        select id into elb_vpc_id
        from vpc
        where
          vpc_id = _vpc_id
        order by id desc
        limit 1;
      
        select id into aux_az_id
        from availability_zone
        where id in (
          select availability_zone_id
          from subnet
          where subnet_id = any(_subnet_ids)
        )
        order by id desc
        limit 1;
      
        insert into elb
          (
            load_balancer_name,
            scheme,
            vpc_id,
            elb_type,
            availability_zone_id,
            ip_address_type
          )
        values
          (
            _name,
            _scheme,
            elb_vpc_id,
            _elb_type,
            aux_az_id,
            _ip_address_type
          );
      
        select id into load_balancer_id
        from elb
        order by id desc
        limit 1;
      
        for sn in
          select id
          from subnet
          where
            subnet_id = any(_subnet_ids)
        loop
          insert into elb_subnets_subnet
            (elb_id, subnet_id)
          values
            (load_balancer_id, sn.id);
        end loop;
      
        for az in
          select id
          from availability_zone
          where id in (
            select availability_zone_id
            from subnet
            where subnet_id = any(_subnet_ids)
          )
        loop
          insert into elb_availability_zones_availability_zone
            (elb_id, availability_zone_id)
          values
            (load_balancer_id, az.id);
        end loop;
      
        for sg in
          select id
          from security_group
          where
            group_name = any(_security_group_names)
        loop
          insert into elb_security_groups_security_group
            (elb_id, security_group_id)
          values
            (load_balancer_id, sg.id);
        end loop;
      
        return load_balancer_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_load_balancer;`);
  }

}
