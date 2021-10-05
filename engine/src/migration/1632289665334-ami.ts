import {MigrationInterface, QueryRunner} from "typeorm";

export class ami1632289665334 implements MigrationInterface {
    name = 'ami1632289665334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "ebs_block_device_type_volumetype_enum" AS ENUM('gp2', 'gp3', 'io1', 'io2', 'sc1', 'st1', 'standard')`);
        await queryRunner.query(`CREATE TABLE "ebs_block_device_type" ("id" SERIAL NOT NULL, "deleteOnTermination" boolean NOT NULL, "iops" integer NOT NULL, "snapshotId" character varying NOT NULL, "volumeSize" integer NOT NULL, "volumeType" "ebs_block_device_type_volumetype_enum" NOT NULL, "kmsKeyId" character varying NOT NULL, "throughput" integer NOT NULL, "outpostArn" character varying NOT NULL, "encrypted" boolean NOT NULL, CONSTRAINT "PK_0b63a25f83033ddd456af000a16" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ebs_block_device_mapping" ("id" SERIAL NOT NULL, "deviceName" character varying NOT NULL, "virtualName" character varying NOT NULL, "noDevice" character varying NOT NULL, "ebs_block_device_type_id" integer, CONSTRAINT "PK_2fab1aa5f825fcde18dff90524b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "product_code" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, CONSTRAINT "PK_6f2664014f87822b6a6b9ad1c95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "state_reason" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "message" character varying NOT NULL, CONSTRAINT "PK_09ff61ed06d22468a89038dea9b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "ami_imagetype_enum" AS ENUM('kernel', 'machine', 'ramdisk')`);
        await queryRunner.query(`CREATE TYPE "ami_platform_enum" AS ENUM('windows', '')`);
        await queryRunner.query(`CREATE TYPE "ami_state_enum" AS ENUM('available', 'deregistered', 'error', 'failed', 'invalid', 'pending', 'transient')`);
        await queryRunner.query(`CREATE TYPE "ami_hypervisor_enum" AS ENUM('ovm', 'xen')`);
        await queryRunner.query(`CREATE TYPE "ami_rootdevicetype_enum" AS ENUM('ebs', 'instance-store')`);
        await queryRunner.query(`CREATE TABLE "ami" ("id" SERIAL NOT NULL, "creationDate" TIMESTAMP WITH TIME ZONE NOT NULL, "imageId" character varying NOT NULL, "imageLocation" character varying NOT NULL, "imageType" "ami_imagetype_enum" NOT NULL, "public" boolean NOT NULL, "kernelId" character varying NOT NULL, "ownerId" character varying NOT NULL, "platform" "ami_platform_enum" NOT NULL, "platformDetails" character varying NOT NULL, "usageOperation" character varying NOT NULL, "ramdiskId" character varying NOT NULL, "state" "ami_state_enum" NOT NULL, "description" character varying NOT NULL, "enaSupport" boolean NOT NULL, "hypervisor" "ami_hypervisor_enum" NOT NULL, "imageOwnerAlias" character varying NOT NULL, "name" character varying NOT NULL, "rootDeviceName" character varying NOT NULL, "rootDeviceType" "ami_rootdevicetype_enum" NOT NULL, "sirovNetSupport" character varying NOT NULL, "deprecationTime" TIMESTAMP WITH TIME ZONE NOT NULL, "cpu_architecture_id" integer, "state_reason_id" integer, "boot_mode_id" integer, CONSTRAINT "PK_a54bc72b5479c0b113aa1da8016" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ami_product_codes_product_code" ("amiId" integer NOT NULL, "productCodeId" integer NOT NULL, CONSTRAINT "PK_7ac1bd18001abba04d94cde3c40" PRIMARY KEY ("amiId", "productCodeId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5f2a13e51f628eda360ec314cb" ON "ami_product_codes_product_code" ("amiId") `);
        await queryRunner.query(`CREATE INDEX "IDX_51cbdd2c81bd2ab1a3b5fdab51" ON "ami_product_codes_product_code" ("productCodeId") `);
        await queryRunner.query(`CREATE TABLE "ami_block_device_mappings_ebs_block_device_mapping" ("amiId" integer NOT NULL, "ebsBlockDeviceMappingId" integer NOT NULL, CONSTRAINT "PK_04b3f6068ea22925c8185799c6e" PRIMARY KEY ("amiId", "ebsBlockDeviceMappingId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b39944b2aae318467ceb02ec1b" ON "ami_block_device_mappings_ebs_block_device_mapping" ("amiId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9becf576d9da01547c5ed95f5f" ON "ami_block_device_mappings_ebs_block_device_mapping" ("ebsBlockDeviceMappingId") `);
        await queryRunner.query(`CREATE TABLE "ami_tags_tag" ("amiId" integer NOT NULL, "tagId" integer NOT NULL, CONSTRAINT "PK_583e55e561937fdfee14c4f5e3f" PRIMARY KEY ("amiId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4b92e6487f752a1a55b6184643" ON "ami_tags_tag" ("amiId") `);
        await queryRunner.query(`CREATE INDEX "IDX_51558a61311eebe1a4e25eb230" ON "ami_tags_tag" ("tagId") `);
        await queryRunner.query(`CREATE TABLE "instance_type_regions_region" ("instanceTypeId" integer NOT NULL, "regionId" integer NOT NULL, CONSTRAINT "PK_0e31dd069fa70a55dc63e0ad803" PRIMARY KEY ("instanceTypeId", "regionId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e147c1d39dd8092fc3052a3454" ON "instance_type_regions_region" ("instanceTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f19bef18ebbdb2ddef5bc4fc9" ON "instance_type_regions_region" ("regionId") `);
        await queryRunner.query(`CREATE TABLE "instance_type_availability_zones_availability_zone" ("instanceTypeId" integer NOT NULL, "availabilityZoneId" integer NOT NULL, CONSTRAINT "PK_985d6b2c9545a5d8101f95ba2dd" PRIMARY KEY ("instanceTypeId", "availabilityZoneId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ddceea37cc8e3a55c25cd183f1" ON "instance_type_availability_zones_availability_zone" ("instanceTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8b593dfecd89b40b47bcb9e92" ON "instance_type_availability_zones_availability_zone" ("availabilityZoneId") `);
        await queryRunner.query(`ALTER TABLE "ebs_block_device_mapping" ADD CONSTRAINT "FK_0fc2e484287ed69ded7dca5075f" FOREIGN KEY ("ebs_block_device_type_id") REFERENCES "ebs_block_device_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ami" ADD CONSTRAINT "FK_78e1561e44dc3250ef5cb7d3672" FOREIGN KEY ("cpu_architecture_id") REFERENCES "cpu_architecture"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ami" ADD CONSTRAINT "FK_cdb3e5c917620b85fb34a1e5a50" FOREIGN KEY ("state_reason_id") REFERENCES "state_reason"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ami" ADD CONSTRAINT "FK_408b59b6259a7380fcdcc4cc0e4" FOREIGN KEY ("boot_mode_id") REFERENCES "boot_mode"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ami_product_codes_product_code" ADD CONSTRAINT "FK_5f2a13e51f628eda360ec314cb1" FOREIGN KEY ("amiId") REFERENCES "ami"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ami_product_codes_product_code" ADD CONSTRAINT "FK_51cbdd2c81bd2ab1a3b5fdab511" FOREIGN KEY ("productCodeId") REFERENCES "product_code"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ami_block_device_mappings_ebs_block_device_mapping" ADD CONSTRAINT "FK_b39944b2aae318467ceb02ec1b2" FOREIGN KEY ("amiId") REFERENCES "ami"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ami_block_device_mappings_ebs_block_device_mapping" ADD CONSTRAINT "FK_9becf576d9da01547c5ed95f5f9" FOREIGN KEY ("ebsBlockDeviceMappingId") REFERENCES "ebs_block_device_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ami_tags_tag" ADD CONSTRAINT "FK_4b92e6487f752a1a55b6184643c" FOREIGN KEY ("amiId") REFERENCES "ami"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ami_tags_tag" ADD CONSTRAINT "FK_51558a61311eebe1a4e25eb230f" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" ADD CONSTRAINT "FK_e147c1d39dd8092fc3052a3454c" FOREIGN KEY ("instanceTypeId") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" ADD CONSTRAINT "FK_9f19bef18ebbdb2ddef5bc4fc9c" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" ADD CONSTRAINT "FK_ddceea37cc8e3a55c25cd183f1c" FOREIGN KEY ("instanceTypeId") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" ADD CONSTRAINT "FK_e8b593dfecd89b40b47bcb9e92c" FOREIGN KEY ("availabilityZoneId") REFERENCES "availability_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" DROP CONSTRAINT "FK_e8b593dfecd89b40b47bcb9e92c"`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" DROP CONSTRAINT "FK_ddceea37cc8e3a55c25cd183f1c"`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" DROP CONSTRAINT "FK_9f19bef18ebbdb2ddef5bc4fc9c"`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" DROP CONSTRAINT "FK_e147c1d39dd8092fc3052a3454c"`);
        await queryRunner.query(`ALTER TABLE "ami_tags_tag" DROP CONSTRAINT "FK_51558a61311eebe1a4e25eb230f"`);
        await queryRunner.query(`ALTER TABLE "ami_tags_tag" DROP CONSTRAINT "FK_4b92e6487f752a1a55b6184643c"`);
        await queryRunner.query(`ALTER TABLE "ami_block_device_mappings_ebs_block_device_mapping" DROP CONSTRAINT "FK_9becf576d9da01547c5ed95f5f9"`);
        await queryRunner.query(`ALTER TABLE "ami_block_device_mappings_ebs_block_device_mapping" DROP CONSTRAINT "FK_b39944b2aae318467ceb02ec1b2"`);
        await queryRunner.query(`ALTER TABLE "ami_product_codes_product_code" DROP CONSTRAINT "FK_51cbdd2c81bd2ab1a3b5fdab511"`);
        await queryRunner.query(`ALTER TABLE "ami_product_codes_product_code" DROP CONSTRAINT "FK_5f2a13e51f628eda360ec314cb1"`);
        await queryRunner.query(`ALTER TABLE "ami" DROP CONSTRAINT "FK_408b59b6259a7380fcdcc4cc0e4"`);
        await queryRunner.query(`ALTER TABLE "ami" DROP CONSTRAINT "FK_cdb3e5c917620b85fb34a1e5a50"`);
        await queryRunner.query(`ALTER TABLE "ami" DROP CONSTRAINT "FK_78e1561e44dc3250ef5cb7d3672"`);
        await queryRunner.query(`ALTER TABLE "ebs_block_device_mapping" DROP CONSTRAINT "FK_0fc2e484287ed69ded7dca5075f"`);
        await queryRunner.query(`DROP INDEX "IDX_e8b593dfecd89b40b47bcb9e92"`);
        await queryRunner.query(`DROP INDEX "IDX_ddceea37cc8e3a55c25cd183f1"`);
        await queryRunner.query(`DROP TABLE "instance_type_availability_zones_availability_zone"`);
        await queryRunner.query(`DROP INDEX "IDX_9f19bef18ebbdb2ddef5bc4fc9"`);
        await queryRunner.query(`DROP INDEX "IDX_e147c1d39dd8092fc3052a3454"`);
        await queryRunner.query(`DROP TABLE "instance_type_regions_region"`);
        await queryRunner.query(`DROP INDEX "IDX_51558a61311eebe1a4e25eb230"`);
        await queryRunner.query(`DROP INDEX "IDX_4b92e6487f752a1a55b6184643"`);
        await queryRunner.query(`DROP TABLE "ami_tags_tag"`);
        await queryRunner.query(`DROP INDEX "IDX_9becf576d9da01547c5ed95f5f"`);
        await queryRunner.query(`DROP INDEX "IDX_b39944b2aae318467ceb02ec1b"`);
        await queryRunner.query(`DROP TABLE "ami_block_device_mappings_ebs_block_device_mapping"`);
        await queryRunner.query(`DROP INDEX "IDX_51cbdd2c81bd2ab1a3b5fdab51"`);
        await queryRunner.query(`DROP INDEX "IDX_5f2a13e51f628eda360ec314cb"`);
        await queryRunner.query(`DROP TABLE "ami_product_codes_product_code"`);
        await queryRunner.query(`DROP TABLE "ami"`);
        await queryRunner.query(`DROP TYPE "ami_rootdevicetype_enum"`);
        await queryRunner.query(`DROP TYPE "ami_hypervisor_enum"`);
        await queryRunner.query(`DROP TYPE "ami_state_enum"`);
        await queryRunner.query(`DROP TYPE "ami_platform_enum"`);
        await queryRunner.query(`DROP TYPE "ami_imagetype_enum"`);
        await queryRunner.query(`DROP TABLE "state_reason"`);
        await queryRunner.query(`DROP TABLE "product_code"`);
        await queryRunner.query(`DROP TABLE "ebs_block_device_mapping"`);
        await queryRunner.query(`DROP TABLE "ebs_block_device_type"`);
        await queryRunner.query(`DROP TYPE "ebs_block_device_type_volumetype_enum"`);
    }

}
