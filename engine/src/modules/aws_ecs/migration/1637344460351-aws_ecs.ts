import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcs1637344460351 implements MigrationInterface {
    name = 'awsEcs1637344460351'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cluster" ("id" SERIAL NOT NULL, "cluster_name" character varying NOT NULL, "cluster_arn" character varying, "cluster_status" character varying, CONSTRAINT "UQ_45ffb6495d51fdc55df46102ce7" UNIQUE ("cluster_name"), CONSTRAINT "PK_b09d39b9491ce5cb1e8407761fd" PRIMARY KEY ("id"))`);
        // Example of use: call create_ecs_cluster('test-sp');
        await queryRunner.query(`
            create or replace procedure create_ecs_cluster(_name text)
            language plpgsql
            as $$
            declare 
                cluster_id integer;
            begin
                insert into cluster
                    (cluster_name)
                values
                    (_name)
                on conflict (cluster_name)
                do nothing;
            
                select id into cluster_id
                from cluster
                where cluster_name = _name
                order by id desc
                limit 1;
            
                raise info 'cluster_id = %', cluster_id;
            end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure create_ecs_cluster;`);
        await queryRunner.query(`DROP TABLE "cluster"`);
    }

}
