import { MigrationInterface, QueryRunner } from "typeorm";

export class rdsSp1634057231558 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_rds_instance('sp-test2', 'postgres', 'db.m5.large', '{default}', 'iasql', '4l4nU$er', 8192, 'eu-west-1c');
    await queryRunner.query(`
    create or replace function create_rds_instance(DBInstanceIdentifier text, dbEngine text, DBInstanceClass text, securitygroupnames text[], MasterUsername text, 
        MasterUserPassword text, AllocatedStorage numeric, availabilityzonename text)
      returns integer as $$ 
      declare
        engine_version_id integer;
        db_instance_class_id integer;
        db_instance_id integer;
          az_id integer;
        sg record;
      begin
        select id into engine_version_id
        from engine_version
        where engine = dbEngine and status = 'available'
        order by id desc
        limit 1;
      
        select id into db_instance_class_id
        from db_instance_class
        where name = DBInstanceClass;
        
        select id into az_id
        from availability_zone
        where zone_name = availabilityzonename;
      
        insert into
          rds (db_instance_identifier, allocated_storage, master_username, master_user_password, db_instance_class_id, engine_version_id, availability_zone_id)
        values
          (DBInstanceIdentifier, AllocatedStorage, MasterUsername, MasterUserPassword, db_instance_class_id, engine_version_id, az_id);
      
        select id into db_instance_id
        from rds
        order by id desc
        limit 1;
      
        for sg in
          select id
          from security_group
          where group_name = any(securitygroupnames)
        loop
          insert into
            rds_vpc_security_groups_security_group (rds_id, security_group_id)
          values
            (db_instance_id, sg.id);
        end loop;
      
        return db_instance_id;
      
      end;
      $$ language plpgsql;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_instance;`);
  }

}
