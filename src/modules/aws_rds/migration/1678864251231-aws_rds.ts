import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsRds1678864251231 implements MigrationInterface {
  name = 'awsRds1678864251231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "db_subnet_group" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "description" character varying, "subnets" character varying array, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_5a641e6e9fdf00cecbaeb496f23" UNIQUE ("arn"), CONSTRAINT "db_subnet_group_id_region" UNIQUE ("id", "region"), CONSTRAINT "db_subnet_group_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_687ed5ce05bd63fa341f8f7fe6f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."db_cluster_engine_enum" AS ENUM('mysql', 'postgres')`);
    await queryRunner.query(
      `CREATE TABLE "db_cluster" ("id" SERIAL NOT NULL, "db_cluster_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "iops" integer NOT NULL, "backup_retention_period" integer NOT NULL DEFAULT '1', "db_cluster_instance_class" character varying NOT NULL, "deletion_protection" boolean DEFAULT false, "engine" "public"."db_cluster_engine_enum" NOT NULL, "engine_version" character varying, "master_user_password" character varying, "master_username" character varying NOT NULL, "port" integer, "publicly_accessible" boolean DEFAULT false, "storage_encrypted" boolean DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), "subnet_group_id" integer, CONSTRAINT "db_cluster_group_id_region" UNIQUE ("id", "region"), CONSTRAINT "UQ_db_cluster_identifier_region" UNIQUE ("db_cluster_identifier", "region"), CONSTRAINT "Check_db_cluster_allocated_storage" CHECK ("allocated_storage">=100 AND "allocated_storage"<=65000), CONSTRAINT "Check_db_cluster_iops" CHECK ("iops">=1000 AND "iops"<=256000), CONSTRAINT "PK_4542fa5ac68deb8f3e54dbde217" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parameter_group_family_enum" AS ENUM('docdb3.6', 'docdb4.0', 'custom-sqlserver-ee-15.0', 'custom-sqlserver-se-15.0', 'custom-sqlserver-web-15.0', 'neptune1', 'mariadb10.2', 'mariadb10.3', 'mariadb10.4', 'mariadb10.5', 'mariadb10.6', 'mysql5.7', 'mysql8.0', 'oracle-ee-19', 'oracle-ee-cdb-19', 'oracle-ee-cdb-21', 'oracle-se2-19', 'oracle-se2-cdb-19', 'oracle-se2-cdb-21', 'postgres10', 'postgres11', 'postgres12', 'postgres13', 'postgres14', 'sqlserver-ee-12.0', 'sqlserver-ee-13.0', 'sqlserver-ee-14.0', 'sqlserver-ee-15.0', 'sqlserver-ex-12.0', 'sqlserver-ex-13.0', 'sqlserver-ex-14.0', 'sqlserver-ex-15.0', 'sqlserver-se-12.0', 'sqlserver-se-13.0', 'sqlserver-se-14.0', 'sqlserver-se-15.0', 'sqlserver-web-12.0', 'sqlserver-web-13.0', 'sqlserver-web-14.0', 'sqlserver-web-15.0')`,
    );
    await queryRunner.query(
      `CREATE TABLE "parameter_group" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "arn" character varying, "family" "public"."parameter_group_family_enum" NOT NULL, "description" character varying NOT NULL, "parameters" jsonb, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "UQ_cd5d35716aae42c8f6acb7dc989" UNIQUE ("arn"), CONSTRAINT "paragrp_id_region" UNIQUE ("id", "region"), CONSTRAINT "paragrp_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_33d024772ff6924f4bc337d865a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "engine_version" character varying, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', "region" character varying NOT NULL DEFAULT default_aws_region(), "availability_zone" character varying NOT NULL, "parameter_group_id" integer, "db_cluster_id" integer, CONSTRAINT "UQ_identifier_region" UNIQUE ("db_instance_identifier", "region"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "db_cluster_security_groups" ("db_cluster_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_f2deb8fce796ceb5603f1422def" PRIMARY KEY ("db_cluster_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d68400e3cedf412cde5b062a06" ON "db_cluster_security_groups" ("db_cluster_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf6786557c49ffda81752e177e" ON "db_cluster_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "rds_security_groups" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_a0b5fa8fc927a6d22d5e2125e86" PRIMARY KEY ("rds_id", "security_group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1927b280e2770235e52a9e0fb" ON "rds_security_groups" ("rds_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a4080f9f7f3fa99ac9d68dd910" ON "rds_security_groups" ("security_group_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "db_subnet_group" ADD CONSTRAINT "FK_8f149647656a06974353fa88d08" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster" ADD CONSTRAINT "FK_f1268b6a9cd7e25c89b84d8a3ee" FOREIGN KEY ("subnet_group_id", "region") REFERENCES "db_subnet_group"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster" ADD CONSTRAINT "FK_28695a318d83a46856d03670d3d" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parameter_group" ADD CONSTRAINT "FK_be8546b2c38fbd6dc4c146d732c" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_651e8eb207ea4120c252c5469f5" FOREIGN KEY ("availability_zone", "region") REFERENCES "availability_zone"("name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_2303532f134366cb86aae40763f" FOREIGN KEY ("parameter_group_id", "region") REFERENCES "parameter_group"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_9239bc5c476dd0b614f18ea1c97" FOREIGN KEY ("db_cluster_id", "region") REFERENCES "db_cluster"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_25dea9b640575575c8049dfb2e7" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster_security_groups" ADD CONSTRAINT "FK_d68400e3cedf412cde5b062a061" FOREIGN KEY ("db_cluster_id") REFERENCES "db_cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster_security_groups" ADD CONSTRAINT "FK_bf6786557c49ffda81752e177e6" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster_security_groups" DROP CONSTRAINT "FK_bf6786557c49ffda81752e177e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "db_cluster_security_groups" DROP CONSTRAINT "FK_d68400e3cedf412cde5b062a061"`,
    );
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_25dea9b640575575c8049dfb2e7"`);
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_9239bc5c476dd0b614f18ea1c97"`);
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_2303532f134366cb86aae40763f"`);
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_651e8eb207ea4120c252c5469f5"`);
    await queryRunner.query(`ALTER TABLE "parameter_group" DROP CONSTRAINT "FK_be8546b2c38fbd6dc4c146d732c"`);
    await queryRunner.query(`ALTER TABLE "db_cluster" DROP CONSTRAINT "FK_28695a318d83a46856d03670d3d"`);
    await queryRunner.query(`ALTER TABLE "db_cluster" DROP CONSTRAINT "FK_f1268b6a9cd7e25c89b84d8a3ee"`);
    await queryRunner.query(`ALTER TABLE "db_subnet_group" DROP CONSTRAINT "FK_8f149647656a06974353fa88d08"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a4080f9f7f3fa99ac9d68dd910"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a1927b280e2770235e52a9e0fb"`);
    await queryRunner.query(`DROP TABLE "rds_security_groups"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bf6786557c49ffda81752e177e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d68400e3cedf412cde5b062a06"`);
    await queryRunner.query(`DROP TABLE "db_cluster_security_groups"`);
    await queryRunner.query(`DROP TABLE "rds"`);
    await queryRunner.query(`DROP TABLE "parameter_group"`);
    await queryRunner.query(`DROP TYPE "public"."parameter_group_family_enum"`);
    await queryRunner.query(`DROP TABLE "db_cluster"`);
    await queryRunner.query(`DROP TYPE "public"."db_cluster_engine_enum"`);
    await queryRunner.query(`DROP TABLE "db_subnet_group"`);
  }
}
