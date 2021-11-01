import { MigrationInterface, QueryRunner } from "typeorm";

export class ecrSp1635769053762 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_ecr_repository('sp-test');
    await queryRunner.query(`
      create or replace function create_ecr_repository(
        _name text
      ) returns integer as $$ 
        declare 
          ecr_repository_id integer;
        begin
        
        insert into repository
          (
            repository_name
          )
        values
          (
            _name
          );
      
        select id into ecr_repository_id
        from repository
        order by id desc
        limit 1;
      
        return ecr_repository_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecr_repository;`);
  }

}
