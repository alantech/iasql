import { MigrationInterface, QueryRunner } from 'typeorm';

export class sshDocker1680100646397 implements MigrationInterface {
  name = 'sshDocker1680100646397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "docker_container"
       (
           "id"           SERIAL            NOT NULL,
           "server_name"  character varying NOT NULL,
           "container_id" character varying,
           "name"         character varying,
           "image"        character varying NOT NULL,
           "env"          jsonb,
           "command"      jsonb,
           "entrypoint"   jsonb,
           "created"      TIMESTAMP,
           "ports"        jsonb             DEFAULT '{}',
           "labels"       jsonb             DEFAULT '{}',
           "state"        character varying DEFAULT 'running',
           "volumes"      jsonb,
           "mounts"       jsonb,
           "binds"        character varying array,
           CONSTRAINT "PK_a9ab810a95845d51a2600fc7808" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `ALTER TABLE "docker_container"
          ADD CONSTRAINT "FK_1825519963ed0389e0a1fba489c" FOREIGN KEY ("server_name") REFERENCES "ssh_credentials" ("name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "docker_container"
          DROP CONSTRAINT "FK_1825519963ed0389e0a1fba489c"`,
    );
    await queryRunner.query(`DROP TABLE "docker_container"`);
  }
}
