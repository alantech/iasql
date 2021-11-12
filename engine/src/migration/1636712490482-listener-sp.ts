import { MigrationInterface, QueryRunner } from "typeorm";

export class listenerSp1636712490482 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_listener;`);
    // Example of use: call create_listener('iasql-postgres-load-balancer', 5432, 'TCP', 'forward', 'iasql-postgres-target-group');
    await queryRunner.query(`
      create or replace procedure create_listener(
        _load_balancer_name text,
        _port integer,
        _protocol listener_protocol_enum,
        _action_type action_action_type_enum,
        _target_group_name text
      )
      language plpgsql
      as $$
        declare
          a_id integer;
          l_id integer;
          lb_id integer;
          tg_id integer;
        begin
          select id into tg_id
          from target_group
          where target_group_name = _target_group_name;
      
          insert into action
            (action_type, target_group_id)
          select  _action_type, tg_id    
          where tg_id not in (
            select target_group_id
            from action
            where target_group_id = tg_id and action_type = _action_type
          );
      
          select id into a_id
          from action
          where target_group_id = tg_id and action_type = _action_type
          order by id desc
          limit 1;
      
          select id into lb_id
          from elb
          where load_balancer_name = _load_balancer_name
          limit 1;
      
          select id into l_id
          from listener
          where elb_id = lb_id and port = _port and protocol = _protocol
          order by id desc
          limit 1;
      
          if l_id is null then
            insert into listener
              (elb_id, port, protocol)
            values 
              (lb_id, _port, _protocol);
      
            select id into l_id
            from listener
            order by id desc
            limit 1;
      
            insert into listener_default_actions_action
              (listener_id, action_id)
            values 
              (lb_id, a_id);
          end if;
      
          raise info 'listener_id = %', l_id;
        end; 
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP procedure create_listener;`);
    // Example of use: select create_listener('iasql-postgres-load-balancer', 5432, 'TCP', 'forward', 'iasql-postgres-target-group');
    await queryRunner.query(`
      create or replace function create_listener(
        _load_balancer_name text,
        _port integer,
        _protocol listener_protocol_enum,
        _action_type action_action_type_enum,
        _target_group_name text
      ) returns integer as $$ 
        declare
          a_id integer;
          l_id integer;
          lb_id integer;
          tg_id integer;
        begin
      
        select id into tg_id
        from target_group
        where target_group_name = _target_group_name;
      
        insert into action
          (action_type, target_group_id)
        values
          (_action_type, tg_id);
      
        select id into a_id
        from action
        order by id desc
        limit 1;
      
        select id into lb_id
        from elb
        where load_balancer_name = _load_balancer_name
        limit 1;
      
        insert into listener
          (elb_id, port, protocol)
        values
          (lb_id, _port, _protocol);
      
        select id into l_id
        from listener
        order by id desc
        limit 1;
      
        insert into listener_default_actions_action
          (listener_id, action_id)
        values
          (l_id, a_id);
      
        return l_id;
        end; $$ language plpgsql;
    `);
  }

}
