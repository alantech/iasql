import { MigrationInterface, QueryRunner } from "typeorm";

export class updateInstanceSp1634291047666 implements MigrationInterface {
  name = 'updateInstanceSp1634291047666'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_instance;`);
    await queryRunner.query(`
      create or replace function create_instance(
        _ami_id text,
        _instance_type text,
        _security_group_names text[],
        _region_name text
      ) returns integer as $$ 
        declare
          ami_id integer;
          instance_type_id integer;
          instance_id integer;
          reg_id integer;
          sg record;
        begin
          select id into ami_id
          from ami
          where 
            image_id = _ami_id
          order by creation_date desc
          limit 1;
        
          select id into instance_type_id
          from instance_type
          where
            instance_type_value_id in (
              select id
              from instance_type_value
              where
                name = _instance_type
            );
      
          select id into reg_id
          from region
          where
            name = _region_name;
        
          insert into instance
            (ami_id, instance_type_id, region_id)
          values
            (ami_id, instance_type_id, reg_id);
        
          select id into instance_id
          from instance
          order by id desc
          limit 1;
        
          for sg in
            select id
            from security_group
            where
              group_name = any(_security_group_names)
          loop
            insert into instance_security_groups_security_group 
              (instance_id, security_group_id)
            values
              (instance_id, sg.id);
          end loop;
        
          return instance_id;
        
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_instance;`);
    await queryRunner.query(`
      create or replace function create_instance(amiid text, instancetype text, securitygroupnames text[])
      returns integer as $$ 
      declare
        ami_id integer;
        instance_type_id integer;
        instance_id integer;
        sg record;
      begin
        select id into ami_id
        from ami
        where image_id = amiid
        order by creation_date desc
        limit 1;
      
        select id into instance_type_id
        from instance_type
        where instance_type_value_id in (
            select id
            from instance_type_value
            where name = instancetype
          );
      
        insert into
          instance (ami_id, instance_type_id)
        values
          (ami_id, instance_type_id);
      
        select id into instance_id
        from instance
        order by id desc
        limit 1;
      
        for sg in
          select id
          from security_group
          where group_name = any(securitygroupnames)
        loop
          insert into
            instance_security_groups_security_group (instance_id, security_group_id)
          values
            (instance_id, sg.id);
        end loop;
      
        return instance_id;
      
      end;
      $$ language plpgsql;
    `);
  }

}
