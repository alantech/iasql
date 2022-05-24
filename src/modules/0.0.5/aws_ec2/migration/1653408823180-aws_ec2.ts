import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEc21653408823180 implements MigrationInterface {
    name = 'awsEc21653408823180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "instance_type" character varying NOT NULL, "key_pair_name" character varying, "tags" json, CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "registered_instances" ("id" SERIAL NOT NULL, "instance" integer, "target_group" character varying, CONSTRAINT "UQ_8cdf955795824ab15c637ffb51a" UNIQUE ("instance", "target_group"), CONSTRAINT "PK_784b3df5b69a437283369988134" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance_security_groups" ("instance_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_8045eb55d2a16cf6e4cf80e7ee5" PRIMARY KEY ("instance_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fa3c179d5090cb1309c63b5e20" ON "instance_security_groups" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3b92934eff56d2eb0477a1d27" ON "instance_security_groups" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "registered_instances" ADD CONSTRAINT "FK_c090cdd030857cbe4670752ad05" FOREIGN KEY ("instance") REFERENCES "instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registered_instances" ADD CONSTRAINT "FK_20091d7cab47075f63c678dea89" FOREIGN KEY ("target_group") REFERENCES "target_group"("target_group_name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" ADD CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_b3b92934eff56d2eb0477a1d27f"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups" DROP CONSTRAINT "FK_fa3c179d5090cb1309c63b5e20a"`);
        await queryRunner.query(`ALTER TABLE "registered_instances" DROP CONSTRAINT "FK_20091d7cab47075f63c678dea89"`);
        await queryRunner.query(`ALTER TABLE "registered_instances" DROP CONSTRAINT "FK_c090cdd030857cbe4670752ad05"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3b92934eff56d2eb0477a1d27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa3c179d5090cb1309c63b5e20"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups"`);
        await queryRunner.query(`DROP TABLE "registered_instances"`);
        await queryRunner.query(`DROP TABLE "instance"`);
    }

}
