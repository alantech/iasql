import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCloudwatch1673532729465 implements MigrationInterface {
  name = 'awsCloudwatch1673532729465';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "log_group" ("id" SERIAL NOT NULL, "log_group_name" character varying NOT NULL, "log_group_arn" character varying, "creation_time" TIMESTAMP WITH TIME ZONE, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_98524f243181f6e4ef712642235" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0debae85724e7e1b623c556fb0" ON "log_group" ("log_group_name", "region") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."metric_alarm_comparison_operator_enum" AS ENUM('GreaterThanOrEqualToThreshold', 'GreaterThanThreshold', 'GreaterThanUpperThreshold', 'LessThanLowerOrGreaterThanUpperThreshold', 'LessThanLowerThreshold', 'LessThanOrEqualToThreshold', 'LessThanThreshold')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."metric_alarm_evaluate_low_sample_count_percentile_enum" AS ENUM('evaluate', 'ignore')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."metric_alarm_statistic_enum" AS ENUM('Average', 'Maximum', 'Minimum', 'SampleCount', 'Sum')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."metric_alarm_treat_missing_data_enum" AS ENUM('breaching', 'notBreaching', 'ignore', 'missing')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."metric_alarm_unit_enum" AS ENUM('Bits', 'Bits/Second', 'Bytes', 'Bytes/Second', 'Count', 'Count/Second', 'Gigabits', 'Gigabits/Second', 'Gigabytes', 'Gigabytes/Second', 'Kilobits', 'Kilobits/Second', 'Kilobytes', 'Kilobytes/Second', 'Megabits', 'Megabits/Second', 'Megabytes', 'Megabytes/Second', 'Microseconds', 'Milliseconds', 'None', 'Percent', 'Seconds', 'Terabits', 'Terabits/Second', 'Terabytes', 'Terabytes/Second')`,
    );
    await queryRunner.query(
      `CREATE TABLE "metric_alarm" ("id" SERIAL NOT NULL, "alarm_name" character varying NOT NULL, "alarm_arn" character varying, "alarm_description" character varying, "actions_enabled" boolean NOT NULL DEFAULT true, "alarm_actions" text array NOT NULL, "comparison_operator" "public"."metric_alarm_comparison_operator_enum", "datapoints_to_alarm" integer, "dimensions" json NOT NULL, "evaluate_low_sample_count_percentile" "public"."metric_alarm_evaluate_low_sample_count_percentile_enum", "evaluation_periods" integer, "extended_statistic" character varying, "insufficient_data_actions" text array NOT NULL, "metric_name" character varying, "metrics" json NOT NULL, "namespace" character varying, "ok_actions" text array NOT NULL, "period" integer, "statistic" "public"."metric_alarm_statistic_enum", "threshold" integer, "threshold_metric_id" character varying, "treat_missing_data" "public"."metric_alarm_treat_missing_data_enum", "unit" "public"."metric_alarm_unit_enum", "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_6154de886b9c1ebb8fa39320b47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f678696b46ad8104d3ccfabbe9" ON "metric_alarm" ("alarm_name", "region") `,
    );
    await queryRunner.query(
      `ALTER TABLE "log_group" ADD CONSTRAINT "FK_8eb78fd886deb6f20a15088e8c6" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "metric_alarm" ADD CONSTRAINT "FK_8c60686b794e211b76518968030" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "metric_alarm" DROP CONSTRAINT "FK_8c60686b794e211b76518968030"`);
    await queryRunner.query(`ALTER TABLE "log_group" DROP CONSTRAINT "FK_8eb78fd886deb6f20a15088e8c6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f678696b46ad8104d3ccfabbe9"`);
    await queryRunner.query(`DROP TABLE "metric_alarm"`);
    await queryRunner.query(`DROP TYPE "public"."metric_alarm_unit_enum"`);
    await queryRunner.query(`DROP TYPE "public"."metric_alarm_treat_missing_data_enum"`);
    await queryRunner.query(`DROP TYPE "public"."metric_alarm_statistic_enum"`);
    await queryRunner.query(`DROP TYPE "public"."metric_alarm_evaluate_low_sample_count_percentile_enum"`);
    await queryRunner.query(`DROP TYPE "public"."metric_alarm_comparison_operator_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0debae85724e7e1b623c556fb0"`);
    await queryRunner.query(`DROP TABLE "log_group"`);
  }
}
