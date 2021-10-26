import {MigrationInterface, QueryRunner} from "typeorm";

export class updateService1635269488510 implements MigrationInterface {
    name = 'updateService1635269488510'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf" ADD "subnet_id" integer`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf" ADD CONSTRAINT "FK_d27269336c2504750c13fe051e9" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf" DROP CONSTRAINT "FK_d27269336c2504750c13fe051e9"`);
        await queryRunner.query(`ALTER TABLE "aws_vpc_conf" DROP COLUMN "subnet_id"`);
    }

}
