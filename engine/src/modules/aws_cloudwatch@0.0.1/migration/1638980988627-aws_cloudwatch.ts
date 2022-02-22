import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCloudwatch1638980988627 implements MigrationInterface {
    name = 'awsCloudwatch1638980988627'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "log_group" ("id" SERIAL NOT NULL, "log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_6d8521becbc3f536b29ee07dc57" UNIQUE ("log_group_name"), CONSTRAINT "PK_98524f243181f6e4ef712642235" PRIMARY KEY ("id"))`);
        // Example of use: call create_or_update_cloudwatch_log_group('test-sp');
        await queryRunner.query(`
            create or replace procedure create_or_update_cloudwatch_log_group(_group_name text)
            language plpgsql
            as $$
            declare 
                log_group_id integer;
            begin
                insert into log_group
                    (log_group_name)
                values
                    (_group_name)
                on conflict (log_group_name)
                do nothing;
            
                select id into log_group_id
                from log_group
                where log_group_name = _group_name
                order by id desc
                limit 1;
            
                raise info 'log_group_id = %', log_group_id;
            end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE "create_or_update_cloudwatch_log_group"`);
        await queryRunner.query(`DROP TABLE "log_group"`);
    }

}
