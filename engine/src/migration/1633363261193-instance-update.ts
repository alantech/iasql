import {MigrationInterface, QueryRunner} from "typeorm";

export class instanceUpdate1633363261193 implements MigrationInterface {
    name = 'instanceUpdate1633363261193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance_security_groups_security_group" ("instance_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_8cafc4cdae339b79467f7ae6069" PRIMARY KEY ("instance_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a3885fdfe2b7e6b9a9b8ee362f" ON "instance_security_groups_security_group" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ca244bab9b151d7f0fc9f378b" ON "instance_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_security_group" ADD CONSTRAINT "FK_a3885fdfe2b7e6b9a9b8ee362ff" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_security_group" ADD CONSTRAINT "FK_1ca244bab9b151d7f0fc9f378b4" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_security_groups_security_group" DROP CONSTRAINT "FK_1ca244bab9b151d7f0fc9f378b4"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_security_group" DROP CONSTRAINT "FK_a3885fdfe2b7e6b9a9b8ee362ff"`);
        await queryRunner.query(`DROP INDEX "IDX_1ca244bab9b151d7f0fc9f378b"`);
        await queryRunner.query(`DROP INDEX "IDX_a3885fdfe2b7e6b9a9b8ee362f"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups_security_group"`);
    }

}
