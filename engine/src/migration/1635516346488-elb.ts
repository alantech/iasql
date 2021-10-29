import {MigrationInterface, QueryRunner} from "typeorm";

export class elb1635516346488 implements MigrationInterface {
    name = 'elb1635516346488'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."elb_scheme_enum" AS ENUM('internal', 'internet-facing')`);
        await queryRunner.query(`CREATE TYPE "public"."elb_state_enum" AS ENUM('active', 'active_impaired', 'failed', 'provisioning')`);
        await queryRunner.query(`CREATE TYPE "public"."elb_elb_type_enum" AS ENUM('application', 'gateway', 'network')`);
        await queryRunner.query(`CREATE TYPE "public"."elb_ip_address_type_enum" AS ENUM('dualstack', 'ipv4')`);
        await queryRunner.query(`CREATE TABLE "elb" ("id" SERIAL NOT NULL, "load_balancer_arn" character varying, "dns_name" character varying, "canonical_hosted_zone_id" character varying, "created_time" TIMESTAMP WITH TIME ZONE, "load_balancer_name" character varying NOT NULL, "scheme" "public"."elb_scheme_enum" NOT NULL, "state" "public"."elb_state_enum", "elb_type" "public"."elb_elb_type_enum" NOT NULL, "ip_address_type" "public"."elb_ip_address_type_enum" NOT NULL, "customer_owned_ipv4_pool" character varying, "vpc_id" integer, "availability_zone_id" integer, CONSTRAINT "UQ_d1dfaca1bedb81deb844d656b8a" UNIQUE ("load_balancer_name"), CONSTRAINT "PK_9e630b193d3416aa15430b97862" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "elb_subnets_subnet" ("elb_id" integer NOT NULL, "subnet_id" integer NOT NULL, CONSTRAINT "PK_29108e36b6c1638d89c629c2bd6" PRIMARY KEY ("elb_id", "subnet_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af9745c14c6f01827e96f1e5c6" ON "elb_subnets_subnet" ("elb_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_38fa9d1072d06a3324c2b7f7e3" ON "elb_subnets_subnet" ("subnet_id") `);
        await queryRunner.query(`CREATE TABLE "elb_availability_zones_availability_zone" ("elb_id" integer NOT NULL, "availability_zone_id" integer NOT NULL, CONSTRAINT "PK_00c65c4f1f385f96cac3ab5f08c" PRIMARY KEY ("elb_id", "availability_zone_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dbb06ecb3e5539ad369e4c688e" ON "elb_availability_zones_availability_zone" ("elb_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0f5fbcb5c8f9cf45a982902d2b" ON "elb_availability_zones_availability_zone" ("availability_zone_id") `);
        await queryRunner.query(`CREATE TABLE "elb_security_groups_security_group" ("elb_id" integer NOT NULL, "security_group_id" integer NOT NULL, CONSTRAINT "PK_4ea5187cfaa14e33a39d370afb5" PRIMARY KEY ("elb_id", "security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ca795b55622c8fdc6a95e99016" ON "elb_security_groups_security_group" ("elb_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b5dc30b24f3acdf1e8ab3f798" ON "elb_security_groups_security_group" ("security_group_id") `);
        await queryRunner.query(`ALTER TABLE "elb" ADD CONSTRAINT "FK_e49120cfdfbb6df299aabb9018f" FOREIGN KEY ("vpc_id") REFERENCES "vpc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "elb" ADD CONSTRAINT "FK_a3b1849774c787a68e0d5b76921" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "elb_subnets_subnet" ADD CONSTRAINT "FK_af9745c14c6f01827e96f1e5c68" FOREIGN KEY ("elb_id") REFERENCES "elb"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "elb_subnets_subnet" ADD CONSTRAINT "FK_38fa9d1072d06a3324c2b7f7e30" FOREIGN KEY ("subnet_id") REFERENCES "subnet"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "elb_availability_zones_availability_zone" ADD CONSTRAINT "FK_dbb06ecb3e5539ad369e4c688ec" FOREIGN KEY ("elb_id") REFERENCES "elb"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "elb_availability_zones_availability_zone" ADD CONSTRAINT "FK_0f5fbcb5c8f9cf45a982902d2b8" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "elb_security_groups_security_group" ADD CONSTRAINT "FK_ca795b55622c8fdc6a95e99016f" FOREIGN KEY ("elb_id") REFERENCES "elb"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "elb_security_groups_security_group" ADD CONSTRAINT "FK_6b5dc30b24f3acdf1e8ab3f7980" FOREIGN KEY ("security_group_id") REFERENCES "security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "elb_security_groups_security_group" DROP CONSTRAINT "FK_6b5dc30b24f3acdf1e8ab3f7980"`);
        await queryRunner.query(`ALTER TABLE "elb_security_groups_security_group" DROP CONSTRAINT "FK_ca795b55622c8fdc6a95e99016f"`);
        await queryRunner.query(`ALTER TABLE "elb_availability_zones_availability_zone" DROP CONSTRAINT "FK_0f5fbcb5c8f9cf45a982902d2b8"`);
        await queryRunner.query(`ALTER TABLE "elb_availability_zones_availability_zone" DROP CONSTRAINT "FK_dbb06ecb3e5539ad369e4c688ec"`);
        await queryRunner.query(`ALTER TABLE "elb_subnets_subnet" DROP CONSTRAINT "FK_38fa9d1072d06a3324c2b7f7e30"`);
        await queryRunner.query(`ALTER TABLE "elb_subnets_subnet" DROP CONSTRAINT "FK_af9745c14c6f01827e96f1e5c68"`);
        await queryRunner.query(`ALTER TABLE "elb" DROP CONSTRAINT "FK_a3b1849774c787a68e0d5b76921"`);
        await queryRunner.query(`ALTER TABLE "elb" DROP CONSTRAINT "FK_e49120cfdfbb6df299aabb9018f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b5dc30b24f3acdf1e8ab3f798"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca795b55622c8fdc6a95e99016"`);
        await queryRunner.query(`DROP TABLE "elb_security_groups_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0f5fbcb5c8f9cf45a982902d2b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbb06ecb3e5539ad369e4c688e"`);
        await queryRunner.query(`DROP TABLE "elb_availability_zones_availability_zone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38fa9d1072d06a3324c2b7f7e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af9745c14c6f01827e96f1e5c6"`);
        await queryRunner.query(`DROP TABLE "elb_subnets_subnet"`);
        await queryRunner.query(`DROP TABLE "elb"`);
        await queryRunner.query(`DROP TYPE "public"."elb_ip_address_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."elb_elb_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."elb_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."elb_scheme_enum"`);
    }

}
