import {MigrationInterface, QueryRunner} from "typeorm";

export class instance1632738426324 implements MigrationInterface {
    name = 'instance1632738426324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami_id" integer, "region_id" integer, "instance_type_id" integer, CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "instance" ADD CONSTRAINT "FK_3a9618687034a9bbed91c9c7290" FOREIGN KEY ("ami_id") REFERENCES "ami"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance" ADD CONSTRAINT "FK_629601e74b48d0feb492656a594" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance" ADD CONSTRAINT "FK_83592733879d33f177bb0a29ad6" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_83592733879d33f177bb0a29ad6"`);
        await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_629601e74b48d0feb492656a594"`);
        await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_3a9618687034a9bbed91c9c7290"`);
        await queryRunner.query(`DROP TABLE "instance"`);
    }

}
