import { MigrationInterface, QueryRunner } from "typeorm";

export class ecsClusterSp1635865948292 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecs_cluster;`);
  }

}
