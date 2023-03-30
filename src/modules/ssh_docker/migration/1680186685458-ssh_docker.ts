import { MigrationInterface, QueryRunner } from 'typeorm';

export class sshDocker1680186685458 implements MigrationInterface {
  name = 'sshDocker1680186685458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."docker_container_state_enum" AS ENUM('created', 'restarting', 'running', 'removing', 'paused', 'exited', 'dead')`,
    );
    await queryRunner.query(`CREATE TABLE "docker_container"
                             (
                                 "id"           SERIAL            NOT NULL,
                                 "server_name"  character varying NOT NULL,
                                 "container_id" character varying,
                                 "name"         character varying,
                                 "image"        character varying NOT NULL,
                                 "env"          character varying array,
                                 "command"      character varying array,
                                 "entrypoint"   character varying array,
                                 "created"      TIMESTAMP,
                                 "ports"        jsonb                                  DEFAULT '{}',
                                 "labels"       jsonb                                  DEFAULT '{}',
                                 "state"        "public"."docker_container_state_enum" DEFAULT 'running',
                                 "volumes"      character varying array,
                                 "mounts"       jsonb,
                                 "binds"        character varying array,
                                 CONSTRAINT "PK_a9ab810a95845d51a2600fc7808" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`ALTER TABLE "docker_container"
        ADD CONSTRAINT "FK_1825519963ed0389e0a1fba489c" FOREIGN KEY ("server_name") REFERENCES "ssh_credentials" ("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "docker_container"
        DROP CONSTRAINT "FK_1825519963ed0389e0a1fba489c"`);
    await queryRunner.query(`DROP TABLE "docker_container"`);
    await queryRunner.query(`DROP TYPE "public"."docker_container_state_enum"`);
  }
}
