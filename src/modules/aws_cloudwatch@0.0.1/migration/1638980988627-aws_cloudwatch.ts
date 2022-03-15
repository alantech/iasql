import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCloudwatch1638980988627 implements MigrationInterface {
    name = 'awsCloudwatch1638980988627'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "log_group" ("id" SERIAL NOT NULL, "log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_6d8521becbc3f536b29ee07dc57" UNIQUE ("log_group_name"), CONSTRAINT "PK_98524f243181f6e4ef712642235" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE "delete_cloudwatch_log_group"`);
        await queryRunner.query(`DROP PROCEDURE "create_or_update_cloudwatch_log_group"`);
        await queryRunner.query(`DROP TABLE "log_group"`);
    }

}
