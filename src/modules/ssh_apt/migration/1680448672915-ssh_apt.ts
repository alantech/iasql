import { MigrationInterface, QueryRunner } from "typeorm";

export class sshApt1680448672915 implements MigrationInterface {
    name = 'sshApt1680448672915'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "package" ("id" SERIAL NOT NULL, "server" character varying NOT NULL, "package" character varying NOT NULL, "version" character varying NOT NULL, "architecture" character varying NOT NULL, "description" character varying, "installed" boolean NOT NULL DEFAULT false, "upgradable" boolean NOT NULL DEFAULT false, CONSTRAINT "uq_package_server_package_version_arch" UNIQUE ("server", "package", "version", "architecture"), CONSTRAINT "PK_308364c66df656295bc4ec467c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "package" ADD CONSTRAINT "FK_a56b73ffe5d4fa84c49d24450a9" FOREIGN KEY ("server") REFERENCES "ssh_credentials"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "package" DROP CONSTRAINT "FK_a56b73ffe5d4fa84c49d24450a9"`);
        await queryRunner.query(`DROP TABLE "package"`);
    }

}
