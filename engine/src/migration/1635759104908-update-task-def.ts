import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTaskDef1635759104908 implements MigrationInterface {
    name = 'updateTaskDef1635759104908'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" DROP COLUMN "cpu"`);
        await queryRunner.query(`ALTER TABLE "task_definition" DROP COLUMN "memory"`);
        await queryRunner.query(`CREATE TYPE "public"."task_definition_cpu_memory_enum" AS ENUM('256-512', '256-1024', '256-2048', '512-1024', '512-2048', '512-3072', '512-4096', '1024-2048', '1024-3072', '1024-4096', '1024-5120', '1024-6144', '1024-7168', '1024-8192', '2048-4096', '2048-5120', '2048-6144', '2048-7168', '2048-8192', '2048-9216', '2048-10240', '2048-11264', '2048-12288', '2048-13312', '2048-14336', '2048-15360', '2048-16384', '4096-8192', '4096-9216', '4096-10240', '4096-11264', '4096-12288', '4096-13312', '4096-14336', '4096-15360', '4096-16384', '4096-17408', '4096-18432', '4096-19456', '4096-20480', '4096-21504', '4096-22528', '4096-23552', '4096-24576', '4096-25600', '4096-26624', '4096-27648', '4096-28672', '4096-29696', '4096-30720')`);
        await queryRunner.query(`ALTER TABLE "task_definition" ADD "cpu_memory" "public"."task_definition_cpu_memory_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_definition" DROP COLUMN "cpu_memory"`);
        await queryRunner.query(`DROP TYPE "public"."task_definition_cpu_memory_enum"`);
        await queryRunner.query(`ALTER TABLE "task_definition" ADD "memory" character varying`);
        await queryRunner.query(`ALTER TABLE "task_definition" ADD "cpu" character varying`);
    }

}
