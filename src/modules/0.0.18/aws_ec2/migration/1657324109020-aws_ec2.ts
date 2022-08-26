import { MigrationInterface, QueryRunner } from 'typeorm';

import * as sql from '../sql';

export class awsEc21657324109020 implements MigrationInterface {
  name = 'awsEc21657324109020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."instance_state_enum" AS ENUM('running', 'stopped', 'hibernate')`
    );
    await queryRunner.query(
      `CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "instance_type" character varying NOT NULL, "key_pair_name" character varying, "state" "public"."instance_state_enum" NOT NULL DEFAULT 'running', "user_data" text, "tags" json, "hibernation_enabled" boolean NOT NULL DEFAULT false, "role_name" character varying, "subnet_id" integer, CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id")); COMMENT ON COLUMN "instance"."instance_id" IS 'Unique identifier provided by AWS once the instance is provisioned'`
    );
    await queryRunner.query(
      `CREATE TABLE "registered_instance" ("port" integer, "instance" integer NOT NULL, "target_group" character varying NOT NULL, CONSTRAINT "PK_9bf32facbba2872745e70d25b3a" PRIMARY KEY ("instance", "target_group"))`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."general_purpose_volume_volume_type_enum" AS ENUM('gp2', 'gp3')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."general_purpose_volume_state_enum" AS ENUM('available', 'creating', 'deleted', 'deleting', 'error', 'in-use')`
    );
    await queryRunner.query(
      `CREATE TABLE "general_purpose_volume" ("id" SERIAL NOT NULL, "volume_id" character varying, "volume_type" "public"."general_purpose_volume_volume_type_enum" NOT NULL, "size" integer NOT NULL DEFAULT '8', "state" "public"."general_purpose_volume_state_enum", "instance_device_name" character varying, "iops" integer, "throughput" integer, "snapshot_id" character varying, "tags" json, "availability_zone" character varying NOT NULL, "attached_instance_id" integer, CONSTRAINT "Unique_gp_instance_device_name" UNIQUE ("instance_device_name", "attached_instance_id"), CONSTRAINT "Check_gp_volume_size_min_max" CHECK ("size" > 0 AND "size" < 16385), CONSTRAINT "Check_gp_volume_instance_device" CHECK (("instance_device_name" IS NULL AND "attached_instance_id" IS NULL) OR ("instance_device_name" IS NOT NULL AND "attached_instance_id" IS NOT NULL)), CONSTRAINT "Check_gp_volume_iops" CHECK ("iops" is NULL OR ("iops" is NOT NULL AND (("volume_type" = 'gp3' AND "iops" <= 16000 AND "iops" >= 3000) OR ("volume_type" = 'gp2' AND "iops" > 0)))), CONSTRAINT "Check_gp_volume_throughput" CHECK ("throughput" IS NULL OR ("throughput" IS NOT NULL AND "volume_type" = 'gp3' AND "throughput" >= 125 AND "throughput" <= 1000)), CONSTRAINT "PK_ded6aa0f99ab2bc666ee032778e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "instance_security_groups" ("instance_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_8045eb55d2a16cf6e4cf80e7ee5" PRIMARY KEY ("instance_id", "security_group_id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa3c179d5090cb1309c63b5e20" ON "instance_security_groups" ("instance_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b3b92934eff56d2eb0477a1d27" ON "instance_security_groups" ("security_group_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "instance" ADD CONSTRAINT "FK_c24c2124cf72257adac2dfa2c8e" FOREIGN KEY ("role_name") REFERENCES "role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "instance" ADD CONSTRAINT "FK_7660424ef50e6538c77706b2480" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" ADD CONSTRAINT "FK_407298b1d222bfd78d4886a254d" FOREIGN KEY ("instance") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" ADD CONSTRAINT "FK_bdcacf2c01109dd6ad3ffab7a83" FOREIGN KEY ("target_group") REFERENCES "target_group"("target_group_name") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" ADD CONSTRAINT "FK_6d207f0b3f4bf5f7c162c28cd9e" FOREIGN KEY ("availability_zone") REFERENCES "availability_zone"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" ADD CONSTRAINT "FK_b60cd423a9b292b547913dcc6ac" FOREIGN KEY ("attached_instance_id") REFERENCES "instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(sql.createCustomConstraints);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(sql.dropCustomConstraints);
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f"`
    );
    await queryRunner.query(
      `ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a"`
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" DROP CONSTRAINT "FK_b60cd423a9b292b547913dcc6ac"`
    );
    await queryRunner.query(
      `ALTER TABLE "general_purpose_volume" DROP CONSTRAINT "FK_6d207f0b3f4bf5f7c162c28cd9e"`
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" DROP CONSTRAINT "FK_bdcacf2c01109dd6ad3ffab7a83"`
    );
    await queryRunner.query(
      `ALTER TABLE "registered_instance" DROP CONSTRAINT "FK_407298b1d222bfd78d4886a254d"`
    );
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
