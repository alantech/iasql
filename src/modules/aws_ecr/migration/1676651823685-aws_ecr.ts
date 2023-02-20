import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsEcr1676651823685 implements MigrationInterface {
  name = 'awsEcr1676651823685';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public_repository" ("repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5a7e30211ae44944c8cd65711dd" PRIMARY KEY ("repository_name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "repository" ("id" SERIAL NOT NULL, "repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "public"."repository_image_tag_mutability_enum" NOT NULL DEFAULT 'MUTABLE', "scan_on_push" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_repository_name_region" UNIQUE ("repository_name", "region"), CONSTRAINT "uq_repository_id_region" UNIQUE ("id", "region"), CONSTRAINT "PK_b842c26651c6fc0b9ccd1c530e2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "repository_id" integer NOT NULL, CONSTRAINT "uq_repository_policy_region" UNIQUE ("id", "region"), CONSTRAINT "REL_d63954354967f55ff8b506931f" UNIQUE ("repository_id", "region"), CONSTRAINT "PK_14f3e653f2de6dd234051222769" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "repository_image" ("id" SERIAL NOT NULL, "image_id" character varying NOT NULL, "image_digest" character varying NOT NULL, "image_tag" character varying NOT NULL, "registry_id" character varying, "pushed_at" TIMESTAMP WITH TIME ZONE, "size_in_mb" integer, "private_repository_region" character varying, "private_repository_id" integer, "public_repository" character varying, CONSTRAINT "uq_repository_image_id_region" UNIQUE ("image_id", "private_repository_region"), CONSTRAINT "uq_repository_image_region" UNIQUE ("id", "private_repository_region"), CONSTRAINT "PK_b78ff8649cde8d938a7c25f8333" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository" ADD CONSTRAINT "FK_93a1a4e1c4fc4aa282463561ea4" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_d63954354967f55ff8b506931fe" FOREIGN KEY ("repository_id", "region") REFERENCES "repository"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_91306c99185bd327ed6c2c70f92" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_image" ADD CONSTRAINT "FK_465546303cde8039965a523ce97" FOREIGN KEY ("private_repository_id", "private_repository_region") REFERENCES "repository"("id","region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_image" ADD CONSTRAINT "FK_73e200bf737f9171cf79db50514" FOREIGN KEY ("public_repository") REFERENCES "public_repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_image" ADD CONSTRAINT "FK_a9205e0321df0fe06f1e2ce0a2b" FOREIGN KEY ("private_repository_region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "repository_image" DROP CONSTRAINT "FK_a9205e0321df0fe06f1e2ce0a2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_image" DROP CONSTRAINT "FK_73e200bf737f9171cf79db50514"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_image" DROP CONSTRAINT "FK_465546303cde8039965a523ce97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_91306c99185bd327ed6c2c70f92"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_d63954354967f55ff8b506931fe"`,
    );
    await queryRunner.query(`ALTER TABLE "repository" DROP CONSTRAINT "FK_93a1a4e1c4fc4aa282463561ea4"`);
    await queryRunner.query(`DROP TABLE "repository_image"`);
    await queryRunner.query(`DROP TABLE "repository_policy"`);
    await queryRunner.query(`DROP TABLE "repository"`);
    await queryRunner.query(`DROP TYPE "public"."repository_image_tag_mutability_enum"`);
    await queryRunner.query(`DROP TABLE "public_repository"`);
  }
}
