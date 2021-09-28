import {MigrationInterface, QueryRunner} from "typeorm";

export class amiUpdates1632760458031 implements MigrationInterface {
    name = 'amiUpdates1632760458031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."product_code" DROP COLUMN "code"`);
        await queryRunner.query(`ALTER TABLE "public"."product_code" ADD "product_code_id" character varying`);
        await queryRunner.query(`ALTER TABLE "public"."product_code" ADD "product_code_type" character varying`);
        await queryRunner.query(`ALTER TABLE "public"."boot_mode" ADD CONSTRAINT "UQ_88a9fac6831af2d520a0947c113" UNIQUE ("mode")`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "delete_on_termination" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "iops" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "snapshot_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "volume_size" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "volume_type" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "kms_key_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "throughput" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "outpost_arn" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "encrypted" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "device_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "virtual_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "no_device" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "creation_date" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_location" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_type" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "public" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "kernel_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "owner_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "platform" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "platform_details" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "usage_operation" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "ramdisk_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "state" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "description" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "ena_support" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "hypervisor" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_owner_alias" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "root_device_name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "root_device_type" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "sirov_net_support" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "deprecation_time" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "deprecation_time" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "sirov_net_support" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "root_device_type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "root_device_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_owner_alias" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "hypervisor" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "ena_support" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "state" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "ramdisk_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "usage_operation" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "platform_details" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "platform" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "owner_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "kernel_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "public" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_location" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "image_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ami" ALTER COLUMN "creation_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "no_device" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "virtual_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_mapping" ALTER COLUMN "device_name" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "encrypted" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "outpost_arn" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "throughput" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "kms_key_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "volume_type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "volume_size" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "snapshot_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "iops" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."ebs_block_device_type" ALTER COLUMN "delete_on_termination" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."boot_mode" DROP CONSTRAINT "UQ_88a9fac6831af2d520a0947c113"`);
        await queryRunner.query(`ALTER TABLE "public"."product_code" DROP COLUMN "product_code_type"`);
        await queryRunner.query(`ALTER TABLE "public"."product_code" DROP COLUMN "product_code_id"`);
        await queryRunner.query(`ALTER TABLE "public"."product_code" ADD "code" character varying NOT NULL`);
    }

}
