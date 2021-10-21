import {MigrationInterface, QueryRunner} from "typeorm";

export class ecrPolicy1634644125046 implements MigrationInterface {
    name = 'ecrPolicy1634644125046'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "repository_id" integer, CONSTRAINT "REL_d3c217e991e59f7680624ccd1d" UNIQUE ("repository_id"), CONSTRAINT "PK_14f3e653f2de6dd234051222769" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_d3c217e991e59f7680624ccd1d5" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "repository_policy" DROP CONSTRAINT "FK_d3c217e991e59f7680624ccd1d5"`);
        await queryRunner.query(`DROP TABLE "repository_policy"`);
    }

}
