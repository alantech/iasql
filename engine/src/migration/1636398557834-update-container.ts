import {MigrationInterface, QueryRunner} from "typeorm";

export class updateContainer1636398557834 implements MigrationInterface {
    name = 'updateContainer1636398557834'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "image"`);
        await queryRunner.query(`ALTER TABLE "container" ADD "docker_image" character varying`);
        await queryRunner.query(`ALTER TABLE "container" ADD "tag" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "container" ADD "repository_id" integer`);
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "CHK_62472abcf5ba6e4bbe53bda676" CHECK ("docker_image" is not null or "repository_id" is not null)`);
        await queryRunner.query(`ALTER TABLE "container" ADD CONSTRAINT "FK_50a8e46cefb58596f984657aa54" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "FK_50a8e46cefb58596f984657aa54"`);
        await queryRunner.query(`ALTER TABLE "container" DROP CONSTRAINT "CHK_62472abcf5ba6e4bbe53bda676"`);
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "repository_id"`);
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "tag"`);
        await queryRunner.query(`ALTER TABLE "container" DROP COLUMN "docker_image"`);
        await queryRunner.query(`ALTER TABLE "container" ADD "image" character varying NOT NULL`);
    }

}
