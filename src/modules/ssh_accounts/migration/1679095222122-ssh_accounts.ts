import { MigrationInterface, QueryRunner } from 'typeorm';

export class sshAccounts1679095222122 implements MigrationInterface {
  name = 'sshAccounts1679095222122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ssh_credentials" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "hostname" character varying NOT NULL, "port" smallint NOT NULL DEFAULT '22', "username" character varying NOT NULL, "private_key" text NOT NULL, "key_passphrase" character varying, CONSTRAINT "UQ_9ee85d9100afcc28e30653254de" UNIQUE ("name"), CONSTRAINT "PK_2c31f9fd13c6f6fb29a4871b8cd" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ssh_credentials"`);
  }
}
