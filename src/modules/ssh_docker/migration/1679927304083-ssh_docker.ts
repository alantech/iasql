import { MigrationInterface, QueryRunner } from 'typeorm';

export class sshDocker1679927304083 implements MigrationInterface {
  name = 'sshDocker1679927304083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "docker_container"
                             (
                                 "id"               SERIAL            NOT NULL,
                                 "server_name"      character varying NOT NULL,
                                 "container_id"     character varying,
                                 "name"             character varying,
                                 "image"            character varying NOT NULL,
                                 "image_id"         character varying,
                                 "command"          character varying,
                                 "created"          TIMESTAMP,
                                 "ports"            jsonb             NOT NULL DEFAULT '[]',
                                 "labels"           jsonb             NOT NULL DEFAULT '{}',
                                 "state"            character varying,
                                 "status"           character varying,
                                 "host_config"      jsonb             NOT NULL DEFAULT '{"NetworkMode":"default"}',
                                 "network_settings" jsonb,
                                 "mounts"           jsonb             NOT NULL DEFAULT '[]',
                                 CONSTRAINT "PK_a9ab810a95845d51a2600fc7808" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(`ALTER TABLE "docker_container"
        ADD CONSTRAINT "FK_1825519963ed0389e0a1fba489c" FOREIGN KEY ("server_name") REFERENCES "ssh_credentials" ("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "docker_container"
        DROP CONSTRAINT "FK_1825519963ed0389e0a1fba489c"`);
    await queryRunner.query(`DROP TABLE "docker_container"`);
  }
}
