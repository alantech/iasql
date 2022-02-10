import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEc21644459507734 implements MigrationInterface {
    name = 'awsEc21644459507734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance_security_groups_aws_security_group" ("instance_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_80d249a863573caab7243ff1b07" PRIMARY KEY ("instance_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ee3dfb3bef7cf8a5123b107167" ON "instance_security_groups_aws_security_group" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0bc4c00d7c86a81c48482a2773" ON "instance_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" ADD CONSTRAINT "FK_ee3dfb3bef7cf8a5123b107167c" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" ADD CONSTRAINT "FK_0bc4c00d7c86a81c48482a2773d" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // Example of use: call create_ec2_instance('ami-0fdffa9be142bf7f4', 't2.micro', array['default'])
       await queryRunner.query(`
           create or replace procedure create_ec2_instance(_ami_id text, _instance_type text, _security_group_names text[])
           language plpgsql
           as $$
               declare
                   instance_id integer;
                   sg record;
               begin
                   insert into instance
                       (ami, instance_type)
                   values
                       (_ami_id, _instance_type);
-
                   select id into instance_id
                   from instance
                   order by id desc
                   limit 1;
-
                   for sg in
                       select id
                       from aws_security_group
                       where group_name = any(_security_group_names)
                   loop
                       insert into
                           instance_security_groups_aws_security_group (instance_id, aws_security_group_id)
                       values
                           (instance_id, sg.id);
                   end loop;
-
                   raise info 'ec2_instance_id = %', instance_id;
               end;
           $$;
       `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure create_ec2_instance;`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" DROP CONSTRAINT "FK_0bc4c00d7c86a81c48482a2773d"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" DROP CONSTRAINT "FK_ee3dfb3bef7cf8a5123b107167c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bc4c00d7c86a81c48482a2773"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee3dfb3bef7cf8a5123b107167"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "instance"`);
    }

}
