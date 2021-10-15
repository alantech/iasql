import { MigrationInterface, QueryRunner } from "typeorm";

export class rdsSp1634207752960 implements MigrationInterface {
  name: 'rdsSp1634207752960'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_rds_instance('sp-test7', 'postgres', 'db.m5.large', array['default'], 'iasql', '4l4nU$er', 50, 'eu-west-1c');
    await queryRunner.query(`
      create or replace function create_rds_instance(
        _db_instance_identifier text,
        _db_engine text,
        _db_instance_class text,
        _security_group_names text [],
        _master_username text,
        _master_user_password text,
        _allocated_storage numeric,
        _availability_zone_name text
      ) returns integer as $$ 
        declare 
          eng_ver_id integer;
          db_ins_clss_id integer;
          db_instance_id integer;
          az_id integer;
          sg record;
          ord_opt integer;
        begin
        select id into eng_ver_id
        from engine_version
        where
          engine = _db_engine
          and status = 'available'
        order by id desc
        limit 1;

        select id into db_ins_clss_id
        from db_instance_class
        where
          name = _db_instance_class;

        select id into az_id
        from availability_zone
        where
          zone_name = _availability_zone_name;

        select count(*) into ord_opt
        from orderable_db_instance_option ord_opt_t
        inner join ord_db_ins_opt_ava_zon_ava_zon ord_opt_az_t 
          on ord_opt_t.id = ord_opt_az_t.orderable_db_instance_option_id
        where
          ord_opt_t.engine_version_id = eng_ver_id
          and ord_opt_t.db_instance_class_id = db_ins_clss_id
          and ord_opt_az_t.availability_zone_id = az_id;

        assert ord_opt > 0, 'Cannot create an RDS instance with this options';

        insert into rds
          (
            db_instance_identifier,
            allocated_storage,
            master_username,
            master_user_password,
            db_instance_class_id,
            engine_version_id,
            availability_zone_id
          )
        values
          (
            _db_instance_identifier,
            _allocated_storage,
            _master_username,
            _master_user_password,
            db_ins_clss_id,
            eng_ver_id,
            az_id
          );

        select id into db_instance_id
        from rds
        order by id desc
        limit 1;

        for sg in
          select id
          from security_group
          where
            group_name = any(_security_group_names)
        loop
          insert into rds_vpc_security_groups_security_group
            (rds_id, security_group_id)
          values
            (db_instance_id, sg.id);
        end loop;

        return db_instance_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_rds_instance;`);
  }

}
