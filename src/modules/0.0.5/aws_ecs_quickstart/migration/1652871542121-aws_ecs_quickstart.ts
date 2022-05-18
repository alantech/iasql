import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcsQuickstart1652871542121 implements MigrationInterface {
    name = 'awsEcsQuickstart1652871542121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ecs_quickstart_cpu_mem_enum" AS ENUM('vCPU0.25-0.5GB', 'vCPU0.25-1GB', 'vCPU0.25-2GB', 'vCPU0.5-1GB', 'vCPU0.5-2GB', 'vCPU0.5-3GB', 'vCPU0.5-4GB', 'vCPU1-2GB', 'vCPU1-3GB', 'vCPU1-4GB', 'vCPU1-5GB', 'vCPU1-6GB', 'vCPU1-7GB', 'vCPU1-8GB', 'vCPU2-4GB', 'vCPU2-5GB', 'vCPU2-6GB', 'vCPU2-7GB', 'vCPU2-8GB', 'vCPU2-9GB', 'vCPU2-10GB', 'vCPU2-11GB', 'vCPU2-12GB', 'vCPU2-13GB', 'vCPU2-14GB', 'vCPU2-15GB', 'vCPU2-16GB', 'vCPU4-8GB', 'vCPU4-9GB', 'vCPU4-10GB', 'vCPU4-11GB', 'vCPU4-12GB', 'vCPU4-13GB', 'vCPU4-14GB', 'vCPU4-15GB', 'vCPU4-16GB', 'vCPU4-17GB', 'vCPU4-18GB', 'vCPU4-19GB', 'vCPU4-20GB', 'vCPU4-21GB', 'vCPU4-22GB', 'vCPU4-23GB', 'vCPU4-24GB', 'vCPU4-25GB', 'vCPU4-26GB', 'vCPU4-27GB', 'vCPU4-28GB', 'vCPU4-29GB', 'vCPU4-30GB')`);
        await queryRunner.query(`CREATE TABLE "ecs_quickstart" ("app_name" character varying NOT NULL, "desired_count" integer, "app_port" integer NOT NULL, "cpu_mem" "public"."ecs_quickstart_cpu_mem_enum", "repository_uri" character varying, "image_tag" character varying, "image_digest" character varying, "private_ecr" boolean NOT NULL DEFAULT false, "public_ecr" boolean NOT NULL DEFAULT false, "public_ip" boolean, "load_balancer_dns" character varying, CONSTRAINT "UQ_38b192448c7b8e62edcc30df4c4" UNIQUE ("app_name"), CONSTRAINT "CHK_16acd218c49cb0ad9f4fb64aea" CHECK (("private_ecr" is TRUE and "public_ecr" is FALSE) or ("private_ecr" is FALSE and "public_ecr" is TRUE) or ("private_ecr" is FALSE and "public_ecr" is FALSE)), CONSTRAINT "CHK_1527e69a90243af9326ad93cdc" CHECK (("image_tag" is null and "image_digest" is null) or ("image_tag" is not null and "image_digest" is null) or ("image_tag" is null and "image_digest" is not null)), CONSTRAINT "PK_38b192448c7b8e62edcc30df4c4" PRIMARY KEY ("app_name"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ecs_quickstart"`);
        await queryRunner.query(`DROP TYPE "public"."ecs_quickstart_cpu_mem_enum"`);
    }

}
