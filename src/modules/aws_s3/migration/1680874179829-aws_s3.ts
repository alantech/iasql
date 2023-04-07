import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsS31680874179829 implements MigrationInterface {
  name = 'awsS31680874179829';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bucket" ("name" character varying NOT NULL, "policy" json, "created_at" TIMESTAMP, "tags" json, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_bucket_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_7bd6e5be634c7e3eb1f2474047a" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bucket_website" ("index_document" character varying NOT NULL, "error_document" character varying, "bucket_name" character varying NOT NULL, CONSTRAINT "PK_450a65ad6132813c9ca2676436c" PRIMARY KEY ("bucket_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bucket_object" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "bucket_name" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), "e_tag" character varying, CONSTRAINT "uq_bucketobject_bucket_name_key_region" UNIQUE ("bucket_name", "key", "region"), CONSTRAINT "PK_6f1581372c9408fae61030e1d55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "public_access_block" ("block_public_acls" boolean NOT NULL DEFAULT true, "ignore_public_acls" boolean NOT NULL DEFAULT true, "block_public_policy" boolean NOT NULL DEFAULT true, "restrict_public_buckets" boolean NOT NULL DEFAULT true, "bucket_name" character varying NOT NULL, CONSTRAINT "PK_d6fdac79c8d56cc6639b56923fe" PRIMARY KEY ("bucket_name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket" ADD CONSTRAINT "FK_853de0389dae8e56caece1fa5da" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket_website" ADD CONSTRAINT "FK_450a65ad6132813c9ca2676436c" FOREIGN KEY ("bucket_name") REFERENCES "bucket"("name") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket_object" ADD CONSTRAINT "FK_17d5255cf02bdc352a134b7b8cc" FOREIGN KEY ("bucket_name", "region") REFERENCES "bucket"("name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket_object" ADD CONSTRAINT "FK_b5dc0fceb794ba8bd6d46075e89" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "public_access_block" ADD CONSTRAINT "FK_d6fdac79c8d56cc6639b56923fe" FOREIGN KEY ("bucket_name") REFERENCES "bucket"("name") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_access_block" DROP CONSTRAINT "FK_d6fdac79c8d56cc6639b56923fe"`,
    );
    await queryRunner.query(`ALTER TABLE "bucket_object" DROP CONSTRAINT "FK_b5dc0fceb794ba8bd6d46075e89"`);
    await queryRunner.query(`ALTER TABLE "bucket_object" DROP CONSTRAINT "FK_17d5255cf02bdc352a134b7b8cc"`);
    await queryRunner.query(`ALTER TABLE "bucket_website" DROP CONSTRAINT "FK_450a65ad6132813c9ca2676436c"`);
    await queryRunner.query(`ALTER TABLE "bucket" DROP CONSTRAINT "FK_853de0389dae8e56caece1fa5da"`);
    await queryRunner.query(`DROP TABLE "public_access_block"`);
    await queryRunner.query(`DROP TABLE "bucket_object"`);
    await queryRunner.query(`DROP TABLE "bucket_website"`);
    await queryRunner.query(`DROP TABLE "bucket"`);
  }
}
