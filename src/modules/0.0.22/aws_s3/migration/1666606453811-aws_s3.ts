import {MigrationInterface, QueryRunner} from "typeorm";

export class awsS31666606453811 implements MigrationInterface {
    name = 'awsS31666606453811'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bucket" ("name" character varying NOT NULL, "policy_document" json, "created_at" TIMESTAMP, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "uq_bucket_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_7bd6e5be634c7e3eb1f2474047a" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "bucket_object" ("key" character varying NOT NULL, "e_tag" character varying, "last_modified" TIMESTAMP, "size" integer, "bucket_name" character varying, CONSTRAINT "PK_d39cf983c9b7915e9d520b27796" PRIMARY KEY ("key"))`);
        await queryRunner.query(`ALTER TABLE "bucket" ADD CONSTRAINT "FK_853de0389dae8e56caece1fa5da" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bucket_object" ADD CONSTRAINT "FK_38599e6deea0c7a461a56c8fd8e" FOREIGN KEY ("bucket_name") REFERENCES "bucket"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bucket_object" DROP CONSTRAINT "FK_38599e6deea0c7a461a56c8fd8e"`);
        await queryRunner.query(`ALTER TABLE "bucket" DROP CONSTRAINT "FK_853de0389dae8e56caece1fa5da"`);
        await queryRunner.query(`DROP TABLE "bucket_object"`);
        await queryRunner.query(`DROP TABLE "bucket"`);
    }

}
