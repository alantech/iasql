import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsEc21666144265865 implements MigrationInterface {
  name = 'awsEc21666144265865';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."instance_state_enum" AS ENUM('running', 'stopped', 'hibernate')`,
    );
    await queryRunner.query(
      `CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "instance_type" character varying NOT NULL, "key_pair_name" character varying, "state" "public"."instance_state_enum" NOT NULL DEFAULT 'running', "user_data" text, "tags" json, "hibernation_enabled" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), "role_name" character varying, "subnet_id" integer, CONSTRAINT "instance_id_region" UNIQUE ("id", "region"), CONSTRAINT "check_role_ec2" CHECK (role_name IS NULL OR (role_name IS NOT NULL AND check_role_ec2(role_name))), CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id")); COMMENT ON COLUMN "instance"."instance_id" IS 'Unique identifier provided by AWS once the instance is provisioned'`,
    );
    await queryRunner.query(
      `CREATE TABLE "registered_instance" ("id" SERIAL NOT NULL, "port" integer, "region" character varying NOT NULL DEFAULT default_aws_region(), "instance" integer, "target_group_id" integer, CONSTRAINT "check_target_group_instance" CHECK (check_target_group_instance(target_group_id)), CONSTRAINT "PK_e566c7adcf3a7974c08b7f1712c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."general_purpose_volume_volume_type_enum" AS ENUM('gp2', 'gp3')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."general_purpose_volume_state_enum" AS ENUM('available', 'creating', 'deleted', 'deleting', 'error', 'in-use')`,
    );
    await queryRunner.query(
      `CREATE TABLE "general_purpose_volume" ("id" SERIAL NOT NULL, "volume_id" character varying, "volume_type" "public"."general_purpose_volume_volume_type_enum" NOT NULL, "size" integer NOT NULL DEFAULT '8', "state" "public"."general_purpose_volume_state_enum", "instance_device_name" character varying, "iops" integer, "throughput" integer, "snapshot_id" character varying, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "availability_zone" character varying NOT NULL, "attached_instance_id" integer, CONSTRAINT "Check_gp_volume_size_min_max" CHECK ("size" > 0 AND "size" < 16385), CONSTRAINT "Check_gp_volume_instance_device" CHECK (("instance_device_name" IS NULL AND "attached_instance_id" IS NULL) OR ("instance_device_name" IS NOT NULL AND "attached_instance_id" IS NOT NULL)), CONSTRAINT "Check_gp_volume_iops" CHECK ("iops" is NULL OR ("iops" is NOT NULL AND (("volume_type" = 'gp3' AND "iops" <= 16000 AND "iops" >= 3000) OR ("volume_type" = 'gp2' AND "iops" > 0)))), CONSTRAINT "Check_gp_volume_throughput" CHECK ("throughput" IS NULL OR ("throughput" IS NOT NULL AND "volume_type" = 'gp3' AND "throughput" >= 125 AND "throughput" <= 1000)), CONSTRAINT "check_instance_ebs_availability_zone" CHECK (check_instance_ebs_availability_zone(attached_instance_id, availability_zone)), CONSTRAINT "PK_ded6aa0f99ab2bc666ee032778e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "instance_security_groups" ("instance_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_8045eb55d2a16cf6e4cf80e7ee5" PRIMARY KEY ("instance_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa3c179d5090cb1309c63b5e20" ON "instance_security_groups" ("instance_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b3b92934eff56d2eb0477a1d27" ON "instance_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "instance" ADD CONSTRAINT "FK_c24c2124cf72257adac2dfa2c8e" FOREIGN KEY ("role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance" ADD CONSTRAINT "FK_7660424ef50e6538c77706b2480" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance" ADD CONSTRAINT "FK_52f1134c0a4287cdb97af5a9886" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" ADD CONSTRAINT "FK_6bf12c7f170e44eeb869e171f0c" FOREIGN KEY ("instance", "region") REFERENCES "instance"("id","region") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" ADD CONSTRAINT "FK_b2f419e2eada3ad14e089612720" FOREIGN KEY ("target_group_id") REFERENCES "target_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" ADD CONSTRAINT "FK_65a392a8bbc87257b1251aeb63e" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" ADD CONSTRAINT "FK_6d207f0b3f4bf5f7c162c28cd9e" FOREIGN KEY ("availability_zone") REFERENCES "availability_zone"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" ADD CONSTRAINT "FK_f4115326fcf8e16edc0ac49f8b1" FOREIGN KEY ("attached_instance_id", "region") REFERENCES "instance"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" ADD CONSTRAINT "FK_6cf180e59980f6cda9aff59af15" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" DROP CONSTRAINT "FK_6cf180e59980f6cda9aff59af15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" DROP CONSTRAINT "FK_f4115326fcf8e16edc0ac49f8b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" DROP CONSTRAINT "FK_6d207f0b3f4bf5f7c162c28cd9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" DROP CONSTRAINT "FK_65a392a8bbc87257b1251aeb63e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" DROP CONSTRAINT "FK_b2f419e2eada3ad14e089612720"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" DROP CONSTRAINT "FK_6bf12c7f170e44eeb869e171f0c"`,
    );
    await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_52f1134c0a4287cdb97af5a9886"`);
    await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_7660424ef50e6538c77706b2480"`);
    await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_c24c2124cf72257adac2dfa2c8e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b3b92934eff56d2eb0477a1d27"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fa3c179d5090cb1309c63b5e20"`);
    await queryRunner.query(`DROP TABLE "instance_security_groups"`);
    await queryRunner.query(`DROP TABLE "general_purpose_volume"`);
    await queryRunner.query(`DROP TYPE "public"."general_purpose_volume_state_enum"`);
    await queryRunner.query(`DROP TYPE "public"."general_purpose_volume_volume_type_enum"`);
    await queryRunner.query(`DROP TABLE "registered_instance"`);
    await queryRunner.query(`DROP TABLE "instance"`);
    await queryRunner.query(`DROP TYPE "public"."instance_state_enum"`);
  }
}
