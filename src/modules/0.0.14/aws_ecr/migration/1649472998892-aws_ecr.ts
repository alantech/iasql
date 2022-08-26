import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsEcr1649472998892 implements MigrationInterface {
  name = 'awsEcr1649472998892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "repository" ("repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "public"."repository_image_tag_mutability_enum" NOT NULL DEFAULT 'MUTABLE', "scan_on_push" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8845a838de662324047b4a9bdd6" PRIMARY KEY ("repository_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "public_repository" ("repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5a7e30211ae44944c8cd65711dd" PRIMARY KEY ("repository_name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "repository_name" character varying NOT NULL, CONSTRAINT "REL_45a97f8e1308371a0b2874ee1c" UNIQUE ("repository_name"), CONSTRAINT "PK_14f3e653f2de6dd234051222769" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_45a97f8e1308371a0b2874ee1c4" FOREIGN KEY ("repository_name") REFERENCES "repository"("repository_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_45a97f8e1308371a0b2874ee1c4"`);
    await queryRunner.query(`DROP TABLE "repository_policy"`);
    await queryRunner.query(`DROP TABLE "public_repository"`);
    await queryRunner.query(`DROP TABLE "repository"`);
    await queryRunner.query(`DROP TYPE "public"."repository_image_tag_mutability_enum"`);
  }
}
