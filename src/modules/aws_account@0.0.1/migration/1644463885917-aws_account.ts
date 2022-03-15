import {MigrationInterface, QueryRunner} from "typeorm";

export class awsAccount1644463885917 implements MigrationInterface {
    name = 'awsAccount1644463885917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "PK_9ad897024d8c36c541d7fe84084" PRIMARY KEY ("id"))`);
        await queryRunner.query(`
            create or replace procedure iasql_schedule_apply()
            language plpgsql
            as $$
            begin
                PERFORM graphile_worker.add_job('scheduleApply');
                raise notice 'Scheduled apply';
            end;
            $$;
        `);
        await queryRunner.query(`
            create or replace procedure iasql_schedule_sync()
            language plpgsql
            as $$
            begin
                PERFORM graphile_worker.add_job('scheduleSync');
                raise notice 'Scheduled sync';
            end;
            $$;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE "iasql_schedule_apply"`);
        await queryRunner.query(`DROP PROCEDURE "iasql_schedule_sync"`);
        await queryRunner.query(`DROP TABLE "aws_account"`);
    }

}
