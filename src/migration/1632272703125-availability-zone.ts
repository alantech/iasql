import {MigrationInterface, QueryRunner} from "typeorm";

export class availabilityZone1632272703125 implements MigrationInterface {
    name = 'availabilityZone1632272703125'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "availability_zone_state_enum" AS ENUM('available', 'impaired', 'information', 'unavailable')`);
        await queryRunner.query(`CREATE TYPE "availability_zone_optinstatus_enum" AS ENUM('not-opted-in', 'opt-in-not-required', 'opted-in')`);
        await queryRunner.query(`CREATE TABLE "availability_zone" ("id" SERIAL NOT NULL, "state" "availability_zone_state_enum" NOT NULL DEFAULT 'available', "optInStatus" "availability_zone_optinstatus_enum" NOT NULL DEFAULT 'opt-in-not-required', "zoneName" character varying NOT NULL, "zoneId" integer NOT NULL, "groupName" character varying NOT NULL, "networkBorderGroup" character varying NOT NULL, "region_id" integer, "parent_zone_id" integer, CONSTRAINT "PK_23adf1bb98959e74d950cf58714" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "availability_zone_message" ("id" SERIAL NOT NULL, "message" character varying NOT NULL, "availability_zone_id" integer, CONSTRAINT "PK_60b38e6df050cc2d22321751c35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_160725b74916b629f0c13aa0f45" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_zone" ADD CONSTRAINT "FK_cafbf58d3030aa29f19048a9f42" FOREIGN KEY ("parent_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "availability_zone_message" ADD CONSTRAINT "FK_764e5bfc94327238c052b608452" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "availability_zone_message" DROP CONSTRAINT "FK_764e5bfc94327238c052b608452"`);
        await queryRunner.query(`ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_cafbf58d3030aa29f19048a9f42"`);
        await queryRunner.query(`ALTER TABLE "availability_zone" DROP CONSTRAINT "FK_160725b74916b629f0c13aa0f45"`);
        await queryRunner.query(`DROP TABLE "availability_zone_message"`);
        await queryRunner.query(`DROP TABLE "availability_zone"`);
        await queryRunner.query(`DROP TYPE "availability_zone_optinstatus_enum"`);
        await queryRunner.query(`DROP TYPE "availability_zone_state_enum"`);
    }

}
