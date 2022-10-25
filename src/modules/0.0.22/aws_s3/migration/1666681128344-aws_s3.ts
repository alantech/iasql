import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsS31666681128344 implements MigrationInterface {
  name = 'awsS31666681128344';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bucket" ("name" character varying NOT NULL, "policy_document" json, "created_at" TIMESTAMP, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_bucket_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_7bd6e5be634c7e3eb1f2474047a" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bucket_object" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "region" character varying NOT NULL DEFAULT default_aws_region(), "e_tag" character varying, "bucket_name" character varying, CONSTRAINT "uq_bucketobject_bucket_key_region" UNIQUE ("key", "region"), CONSTRAINT "uq_bucketobject_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_da5e9d15d6cfa0ee89361822ce2" PRIMARY KEY ("id", "key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket" ADD CONSTRAINT "FK_853de0389dae8e56caece1fa5da" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket_object" ADD CONSTRAINT "FK_17d5255cf02bdc352a134b7b8cc" FOREIGN KEY ("bucket_name", "region") REFERENCES "bucket"("name","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bucket_object" ADD CONSTRAINT "FK_b5dc0fceb794ba8bd6d46075e89" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bucket_object" DROP CONSTRAINT "FK_b5dc0fceb794ba8bd6d46075e89"`);
    await queryRunner.query(`ALTER TABLE "bucket_object" DROP CONSTRAINT "FK_17d5255cf02bdc352a134b7b8cc"`);
    await queryRunner.query(`ALTER TABLE "bucket" DROP CONSTRAINT "FK_853de0389dae8e56caece1fa5da"`);
    await queryRunner.query(`DROP TABLE "bucket_object"`);
    await queryRunner.query(`DROP TABLE "bucket"`);
  }
}
