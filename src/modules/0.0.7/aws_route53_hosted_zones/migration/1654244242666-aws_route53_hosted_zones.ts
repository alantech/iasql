import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRoute53HostedZones1654244242666 implements MigrationInterface {
    name = 'awsRoute53HostedZones1654244242666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "hosted_zone" ("id" SERIAL NOT NULL, "hosted_zone_id" character varying, "domain_name" character varying NOT NULL, CONSTRAINT "UQ_5da101a3f94155dbe60f03ef090" UNIQUE ("hosted_zone_id"), CONSTRAINT "PK_6c259b4713ec9765d0977bb7af2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."resource_record_set_record_type_enum" AS ENUM('A', 'AAAA', 'CAA', 'CNAME', 'DS', 'MX', 'NAPTR', 'NS', 'PTR', 'SOA', 'SPF', 'SRV', 'TXT')`);
        await queryRunner.query(`CREATE TABLE "resource_record_set" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "record_type" "public"."resource_record_set_record_type_enum" NOT NULL, "record" character varying NOT NULL, "ttl" integer, "parent_hosted_zone_id" integer, CONSTRAINT "UQ_name__record_type" UNIQUE ("name", "record_type"), CONSTRAINT "PK_6f476cd79c05adaa9a404f8e52a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "resource_record_set" ADD CONSTRAINT "FK_e0318e494828360d4596194b445" FOREIGN KEY ("parent_hosted_zone_id") REFERENCES "hosted_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resource_record_set" DROP CONSTRAINT "FK_e0318e494828360d4596194b445"`);
        await queryRunner.query(`DROP TABLE "resource_record_set"`);
        await queryRunner.query(`DROP TYPE "public"."resource_record_set_record_type_enum"`);
        await queryRunner.query(`DROP TABLE "hosted_zone"`);
    }

}
