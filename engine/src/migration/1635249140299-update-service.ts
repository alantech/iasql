import {MigrationInterface, QueryRunner} from "typeorm";

export class updateService1635249140299 implements MigrationInterface {
    name = 'updateService1635249140299'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "UQ_aeef40fe1f9b32afe23174bb9af" UNIQUE ("aws_vpc_conf_id")`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" DROP CONSTRAINT "UQ_aeef40fe1f9b32afe23174bb9af"`);
        await queryRunner.query(`ALTER TABLE "service" ADD CONSTRAINT "FK_aeef40fe1f9b32afe23174bb9af" FOREIGN KEY ("aws_vpc_conf_id") REFERENCES "aws_vpc_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
