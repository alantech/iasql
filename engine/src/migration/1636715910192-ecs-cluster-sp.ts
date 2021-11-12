import { MigrationInterface, QueryRunner } from "typeorm";

export class ecsClusterSp1636715910192 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecs_cluster;`);
    // Example of use: call create_ecs_cluster('test-sp');
    await queryRunner.query(`
      create or replace procedure create_ecs_cluster(_name text)
      language plpgsql
      as $$
        declare 
          cluster_id integer;
        begin
          insert into cluster
            (name)
          values
            (_name)
          on conflict (name)
          do nothing;
        
          select id into cluster_id
          from cluster
          where name = _name
          order by id desc
          limit 1;
        
          raise info 'cluster_id = %', cluster_id;
        end;
      $$;    
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP procedure create_ecs_cluster;`);
    // Example of use: select * from create_ecs_cluster('test-sp');
    await queryRunner.query(`
      create or replace function create_ecs_cluster(
        _name text
      ) returns integer as $$ 
        declare 
          cluster_id integer;
        begin
      
        insert into cluster
          (
            name
          )
        values
          (
            _name
          );
      
        select id into cluster_id
        from cluster
        order by id desc
        limit 1;
      
        return cluster_id;
        end; $$ language plpgsql;
  `);
  }

}
