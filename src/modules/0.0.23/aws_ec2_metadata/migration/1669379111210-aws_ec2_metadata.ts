import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsEc2Metadata1669379111210 implements MigrationInterface {
  name = 'awsEc2Metadata1669379111210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."instance_metadata_architecture_enum" AS ENUM('arm64', 'i386', 'x86_64', 'x86_64_mac')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."instance_metadata_root_device_type_enum" AS ENUM('ebs', 'instance-store')`,
    );
    await queryRunner.query(
      `CREATE TABLE "instance_metadata" ("id" integer NOT NULL, "instance_id" character varying NOT NULL, "architecture" "public"."instance_metadata_architecture_enum" NOT NULL, "private_ip_address" cidr NOT NULL, "public_ip_address" cidr NOT NULL, "public_dns_name" character varying NOT NULL, "launch_time" TIMESTAMP WITH TIME ZONE NOT NULL, "cpu_cores" integer NOT NULL, "mem_size_mb" integer NOT NULL, "ebs_optimized" boolean NOT NULL, "root_device_type" "public"."instance_metadata_root_device_type_enum" NOT NULL, "root_device_name" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "REL_d3c7f86b7628690e6e68ccebbe" UNIQUE ("id"), CONSTRAINT "PK_e34728db56b9cf43fad3f80039f" PRIMARY KEY ("instance_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_metadata" ADD CONSTRAINT "FK_d3c7f86b7628690e6e68ccebbeb" FOREIGN KEY ("id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_metadata" ADD CONSTRAINT "FK_12f3ab0458b0e1965e9e5cfba7e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "instance_metadata" DROP CONSTRAINT "FK_12f3ab0458b0e1965e9e5cfba7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_metadata" DROP CONSTRAINT "FK_d3c7f86b7628690e6e68ccebbeb"`,
    );
    await queryRunner.query(`DROP TABLE "instance_metadata"`);
    await queryRunner.query(`DROP TYPE "public"."instance_metadata_root_device_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."instance_metadata_architecture_enum"`);
  }
}
