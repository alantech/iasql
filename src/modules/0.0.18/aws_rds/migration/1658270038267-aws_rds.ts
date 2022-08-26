import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsRds1658270038267 implements MigrationInterface {
  name = 'awsRds1658270038267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."parameter_group_family_enum" AS ENUM('aurora-mysql5.7', 'aurora-mysql8.0', 'docdb3.6', 'docdb4.0', 'custom-sqlserver-ee-15.0', 'custom-sqlserver-se-15.0', 'custom-sqlserver-web-15.0', 'neptune1', 'aurora-postgresql10', 'aurora-postgresql11', 'aurora-postgresql12', 'aurora-postgresql13', 'mariadb10.2', 'mariadb10.3', 'mariadb10.4', 'mariadb10.5', 'mariadb10.6', 'mysql5.7', 'mysql8.0', 'oracle-ee-19', 'oracle-ee-cdb-19', 'oracle-ee-cdb-21', 'oracle-se2-19', 'oracle-se2-cdb-19', 'oracle-se2-cdb-21', 'aurora5.6', 'postgres10', 'postgres11', 'postgres12', 'postgres13', 'postgres14', 'sqlserver-ee-12.0', 'sqlserver-ee-13.0', 'sqlserver-ee-14.0', 'sqlserver-ee-15.0', 'sqlserver-ex-12.0', 'sqlserver-ex-13.0', 'sqlserver-ex-14.0', 'sqlserver-ex-15.0', 'sqlserver-se-12.0', 'sqlserver-se-13.0', 'sqlserver-se-14.0', 'sqlserver-se-15.0', 'sqlserver-web-12.0', 'sqlserver-web-13.0', 'sqlserver-web-14.0', 'sqlserver-web-15.0')`
    );
    await queryRunner.query(
      `CREATE TABLE "parameter_group" ("name" character varying NOT NULL, "arn" character varying, "family" "public"."parameter_group_family_enum" NOT NULL, "description" character varying NOT NULL, "parameters" jsonb, CONSTRAINT "UQ_cd5d35716aae42c8f6acb7dc989" UNIQUE ("arn"), CONSTRAINT "PK_d1f1ec0894042fdb4c40575feff" PRIMARY KEY ("name"))`
    );
    await queryRunner.query(
      `CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', "availability_zone" character varying NOT NULL, "parameter_group_name" character varying, CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "rds_security_groups" ("rds_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_a0b5fa8fc927a6d22d5e2125e86" PRIMARY KEY ("rds_id", "security_group_id"))`
    );
    await queryRunner.query(`CREATE INDEX "IDX_a1927b280e2770235e52a9e0fb" ON "rds_security_groups" ("rds_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_a4080f9f7f3fa99ac9d68dd910" ON "rds_security_groups" ("security_group_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_4c5ad183bee6e2e1364213be525" FOREIGN KEY ("availability_zone") REFERENCES "availability_zone"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "rds" ADD CONSTRAINT "FK_13a712475f3f2ddad6d8fd5d3f1" FOREIGN KEY ("parameter_group_name") REFERENCES "parameter_group"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "rds_security_groups" ADD CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a4080f9f7f3fa99ac9d68dd910a"`);
    await queryRunner.query(`ALTER TABLE "rds_security_groups" DROP CONSTRAINT "FK_a1927b280e2770235e52a9e0fb1"`);
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_13a712475f3f2ddad6d8fd5d3f1"`);
    await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_4c5ad183bee6e2e1364213be525"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a4080f9f7f3fa99ac9d68dd910"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a1927b280e2770235e52a9e0fb"`);
    await queryRunner.query(`DROP TABLE "rds_security_groups"`);
    await queryRunner.query(`DROP TABLE "rds"`);
    await queryRunner.query(`DROP TABLE "parameter_group"`);
    await queryRunner.query(`DROP TYPE "public"."parameter_group_family_enum"`);
  }
}
