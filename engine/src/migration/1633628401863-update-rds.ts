import {MigrationInterface, QueryRunner} from "typeorm";

export class updateRds1633628401863 implements MigrationInterface {
    name = 'updateRds1633628401863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds" ADD "db_instance_status" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "automatic_restart_time" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "endpoint" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "instance_create_time" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "db_subnet_group" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "latest_restorable_time" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "ca_certificate_identifier" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "db_instance_arn" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "associated_roles" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "listener_endpoint" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "aws_backup_recovery_point_arn" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "activity_stream_status" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "activity_stream_mode" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "activity_stream_kms_key_id" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "activity_stream_kinesis_stream_name" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "activity_stream_engine_native_audit_fields_included" boolean`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "read_replica_source_db_instance_identifier" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "read_replica_db_instance_identifiers" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "read_replica_db_cluster_identifiers" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "replica_mode" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "status_infos" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "db_instance_automated_backups_replications" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "db_instance_automated_backups_replications"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "status_infos"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "replica_mode"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "read_replica_db_cluster_identifiers"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "read_replica_db_instance_identifiers"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "read_replica_source_db_instance_identifier"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "activity_stream_engine_native_audit_fields_included"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "activity_stream_kinesis_stream_name"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "activity_stream_kms_key_id"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "activity_stream_mode"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "activity_stream_status"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "aws_backup_recovery_point_arn"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "listener_endpoint"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "associated_roles"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "db_instance_arn"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "ca_certificate_identifier"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "latest_restorable_time"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "db_subnet_group"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "instance_create_time"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "endpoint"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "automatic_restart_time"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "db_instance_status"`);
    }

}
