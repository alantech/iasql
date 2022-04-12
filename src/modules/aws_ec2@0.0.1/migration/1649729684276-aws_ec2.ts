import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEc21649729684276 implements MigrationInterface {
    name = 'awsEc21649729684276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "name" character varying NOT NULL, "instance_type" character varying NOT NULL, "key_pair_name" character varying, CONSTRAINT "UQ_7517ace937bf54b1902089eedf0" UNIQUE ("name"), CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance_security_groups" ("instance_id" integer NOT NULL, "security_group_group_name" character varying NOT NULL, CONSTRAINT "PK_3dcd8e0d7c81218a0eaa4170ef0" PRIMARY KEY ("instance_id", "security_group_group_name"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fa3c179d5090cb1309c63b5e20" ON "instance_security_groups" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_27fe817a251df4c77163858672" ON "instance_security_groups" ("security_group_group_name") `);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_27fe817a251df4c771638586727" FOREIGN KEY ("security_group_group_name") REFERENCES "security_group"("group_name") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_27fe817a251df4c771638586727"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27fe817a251df4c77163858672"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa3c179d5090cb1309c63b5e20"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups"`);
        await queryRunner.query(`DROP TABLE "instance"`);
    }

}
