import {MigrationInterface, QueryRunner} from "typeorm";

export class listeners1636051286994 implements MigrationInterface {
    name = 'listeners1636051286994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."listener_protocol_enum" AS ENUM('GENEVE', 'HTTP', 'HTTPS', 'TCP', 'TCP_UDP', 'TLS', 'UDP')`);
        await queryRunner.query(`CREATE TABLE "listener" ("id" SERIAL NOT NULL, "listener_arn" character varying, "port" integer NOT NULL, "protocol" "public"."listener_protocol_enum" NOT NULL, "elb_id" integer, CONSTRAINT "PK_422c9d250eb7b0c0b6c96cdce94" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."action_action_type_enum" AS ENUM('forward')`);
        await queryRunner.query(`CREATE TABLE "action" ("id" SERIAL NOT NULL, "action_type" "public"."action_action_type_enum" NOT NULL, "target_group_id" integer, CONSTRAINT "PK_2d9db9cf5edfbbae74eb56e3a39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "listener_default_actions_action" ("listener_id" integer NOT NULL, "action_id" integer NOT NULL, CONSTRAINT "PK_6b9ab4d7198031f7f2e86f3c656" PRIMARY KEY ("listener_id", "action_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ba0f5160a7e4d76f0cabe6137f" ON "listener_default_actions_action" ("listener_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_982fa5e65dd4ca9de573dd20e6" ON "listener_default_actions_action" ("action_id") `);
        await queryRunner.query(`ALTER TABLE "listener" ADD CONSTRAINT "FK_573984567828151e4ddd90907ed" FOREIGN KEY ("elb_id") REFERENCES "elb"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action" ADD CONSTRAINT "FK_7e284fb7688e7060d5519a9fccb" FOREIGN KEY ("target_group_id") REFERENCES "target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "listener_default_actions_action" ADD CONSTRAINT "FK_ba0f5160a7e4d76f0cabe6137f1" FOREIGN KEY ("listener_id") REFERENCES "listener"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "listener_default_actions_action" ADD CONSTRAINT "FK_982fa5e65dd4ca9de573dd20e6d" FOREIGN KEY ("action_id") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "listener_default_actions_action" DROP CONSTRAINT "FK_982fa5e65dd4ca9de573dd20e6d"`);
        await queryRunner.query(`ALTER TABLE "listener_default_actions_action" DROP CONSTRAINT "FK_ba0f5160a7e4d76f0cabe6137f1"`);
        await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_7e284fb7688e7060d5519a9fccb"`);
        await queryRunner.query(`ALTER TABLE "listener" DROP CONSTRAINT "FK_573984567828151e4ddd90907ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_982fa5e65dd4ca9de573dd20e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba0f5160a7e4d76f0cabe6137f"`);
        await queryRunner.query(`DROP TABLE "listener_default_actions_action"`);
        await queryRunner.query(`DROP TABLE "action"`);
        await queryRunner.query(`DROP TYPE "public"."action_action_type_enum"`);
        await queryRunner.query(`DROP TABLE "listener"`);
        await queryRunner.query(`DROP TYPE "public"."listener_protocol_enum"`);
    }

}
