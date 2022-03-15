import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEc21646173335775 implements MigrationInterface {
    name = 'awsEc21646173335775'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "name" character varying NOT NULL, "instance_type" character varying NOT NULL, CONSTRAINT "UQ_7517ace937bf54b1902089eedf0" UNIQUE ("name"), CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance_security_groups" ("instance_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_46a10750b6a7747b450bfb26f08" PRIMARY KEY ("instance_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fa3c179d5090cb1309c63b5e20" ON "instance_security_groups" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8212b4abce910f4524d3af339e" ON "instance_security_groups" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_8212b4abce910f4524d3af339e8" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_8212b4abce910f4524d3af339e8"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8212b4abce910f4524d3af339e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa3c179d5090cb1309c63b5e20"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups"`);
        await queryRunner.query(`DROP TABLE "instance"`);
    }

}
