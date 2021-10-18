import {MigrationInterface, QueryRunner} from "typeorm";

export class awsCredentials1634559809888 implements MigrationInterface {
    name = 'awsCredentials1634559809888'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" RENAME COLUMN "region" TO "region_id"`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" DROP COLUMN "region_id"`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" ADD "region_id" integer`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" ADD CONSTRAINT "FK_1b768f2f9ff710aff0d83d0bc46" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" DROP CONSTRAINT "FK_1b768f2f9ff710aff0d83d0bc46"`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" DROP COLUMN "region_id"`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" ADD "region_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."aws_credentials" RENAME COLUMN "region_id" TO "region"`);
    }

}
