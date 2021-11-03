import {MigrationInterface, QueryRunner} from "typeorm";

export class updateServiceElb1635932450742 implements MigrationInterface {
    name = 'updateServiceElb1635932450742'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "service_load_balancer" ("id" SERIAL NOT NULL, "container_name" character varying NOT NULL, "container_port" integer NOT NULL, "target_group_id" integer, "elb_id" integer, CONSTRAINT "PK_4cc8d175d0a19a9109ed66ea512" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "service_load_balancers_service_load_balancer" ("service_id" integer NOT NULL, "service_load_balancer_id" integer NOT NULL, CONSTRAINT "PK_76e9299dcd9aa45dc8838447d6d" PRIMARY KEY ("service_id", "service_load_balancer_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_07133468e6971294c9960d7b25" ON "service_load_balancers_service_load_balancer" ("service_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6e5bf1aa2a280f96dd7afaf7e" ON "service_load_balancers_service_load_balancer" ("service_load_balancer_id") `);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_fed6565f2a94539d1d57d25f798" FOREIGN KEY ("target_group_id") REFERENCES "target_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" ADD CONSTRAINT "FK_363118760aef03b1cfe65809a7c" FOREIGN KEY ("elb_id") REFERENCES "elb"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_07133468e6971294c9960d7b25a" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" ADD CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec" FOREIGN KEY ("service_load_balancer_id") REFERENCES "service_load_balancer"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_e6e5bf1aa2a280f96dd7afaf7ec"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancers_service_load_balancer" DROP CONSTRAINT "FK_07133468e6971294c9960d7b25a"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_363118760aef03b1cfe65809a7c"`);
        await queryRunner.query(`ALTER TABLE "service_load_balancer" DROP CONSTRAINT "FK_fed6565f2a94539d1d57d25f798"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6e5bf1aa2a280f96dd7afaf7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07133468e6971294c9960d7b25"`);
        await queryRunner.query(`DROP TABLE "service_load_balancers_service_load_balancer"`);
        await queryRunner.query(`DROP TABLE "service_load_balancer"`);
    }

}
