import {MigrationInterface, QueryRunner} from "typeorm";

export class containerDefinition1634822632356 implements MigrationInterface {
    name = 'containerDefinition1634822632356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "environmet_variable" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_0c6e9879ee541ab6183c962219e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."port_mapping_protocol_enum" AS ENUM('tcp', 'udp')`);
        await queryRunner.query(`CREATE TABLE "port_mapping" ("id" SERIAL NOT NULL, "container_port" integer, "host_port" integer, "protocol" "public"."port_mapping_protocol_enum" NOT NULL, CONSTRAINT "PK_d39258100f33186bb74757e25d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_definition" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "image" character varying NOT NULL, "essential" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_14f850c34e63edcdfd0aa66d316" UNIQUE ("name"), CONSTRAINT "PK_74656f796df3346fa6ec89fa727" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "container_definition_port_mappings_port_mapping" ("container_definition_id" integer NOT NULL, "port_mapping_id" integer NOT NULL, CONSTRAINT "PK_86bba0922c06aa2d94b3c4b6bcb" PRIMARY KEY ("container_definition_id", "port_mapping_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f24b4df268d81f6b0d7332955" ON "container_definition_port_mappings_port_mapping" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d191532cf18e6888e27a8c13e4" ON "container_definition_port_mappings_port_mapping" ("port_mapping_id") `);
        await queryRunner.query(`CREATE TABLE "container_definition_environment_environmet_variable" ("container_definition_id" integer NOT NULL, "environmet_variable_id" integer NOT NULL, CONSTRAINT "PK_825f457e3bdccd6bfe4a3a47456" PRIMARY KEY ("container_definition_id", "environmet_variable_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5bce8e5072edab99cbd2d20826" ON "container_definition_environment_environmet_variable" ("container_definition_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f0cd7ad3044cc98155f82a2ac" ON "container_definition_environment_environmet_variable" ("environmet_variable_id") `);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_4f24b4df268d81f6b0d73329557" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" ADD CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d" FOREIGN KEY ("port_mapping_id") REFERENCES "port_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" ADD CONSTRAINT "FK_5bce8e5072edab99cbd2d208261" FOREIGN KEY ("container_definition_id") REFERENCES "container_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" ADD CONSTRAINT "FK_1f0cd7ad3044cc98155f82a2ac4" FOREIGN KEY ("environmet_variable_id") REFERENCES "environmet_variable"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" DROP CONSTRAINT "FK_1f0cd7ad3044cc98155f82a2ac4"`);
        await queryRunner.query(`ALTER TABLE "container_definition_environment_environmet_variable" DROP CONSTRAINT "FK_5bce8e5072edab99cbd2d208261"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_d191532cf18e6888e27a8c13e4d"`);
        await queryRunner.query(`ALTER TABLE "container_definition_port_mappings_port_mapping" DROP CONSTRAINT "FK_4f24b4df268d81f6b0d73329557"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f0cd7ad3044cc98155f82a2ac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5bce8e5072edab99cbd2d20826"`);
        await queryRunner.query(`DROP TABLE "container_definition_environment_environmet_variable"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d191532cf18e6888e27a8c13e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f24b4df268d81f6b0d7332955"`);
        await queryRunner.query(`DROP TABLE "container_definition_port_mappings_port_mapping"`);
        await queryRunner.query(`DROP TABLE "container_definition"`);
        await queryRunner.query(`DROP TABLE "port_mapping"`);
        await queryRunner.query(`DROP TYPE "public"."port_mapping_protocol_enum"`);
        await queryRunner.query(`DROP TABLE "environmet_variable"`);
    }

}
