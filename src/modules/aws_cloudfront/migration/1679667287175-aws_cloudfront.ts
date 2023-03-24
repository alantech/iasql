import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCloudfront1679667287175 implements MigrationInterface {
  name = 'awsCloudfront1679667287175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "distribution" ("id" SERIAL NOT NULL, "distribution_id" character varying, "domain_name" character varying, "caller_reference" character varying NOT NULL DEFAULT now(), "comment" character varying NOT NULL DEFAULT '', "enabled" boolean NOT NULL DEFAULT true, "is_ipv6_enabled" boolean, "web_acl_id" character varying, "default_cache_behavior" json NOT NULL, "origins" json NOT NULL, "e_tag" character varying, "status" character varying, "alternate_domain_names" character varying array, "custom_ssl_certificate_id" integer, CONSTRAINT "PK_187eaf203ccf9018df51b40108c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "distribution" ADD CONSTRAINT "FK_6e0b4f92baea02c4f24a48ee22c" FOREIGN KEY ("custom_ssl_certificate_id") REFERENCES "certificate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "distribution" DROP CONSTRAINT "FK_6e0b4f92baea02c4f24a48ee22c"`);
    await queryRunner.query(`DROP TABLE "distribution"`);
  }
}
