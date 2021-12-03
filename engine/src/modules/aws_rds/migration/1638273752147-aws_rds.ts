import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1638273752147 implements MigrationInterface {
    name = 'awsRds1638273752147'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "engine_version" ("id" SERIAL NOT NULL, "engine" character varying NOT NULL, "engine_version" character varying NOT NULL, "engine_version_key" character varying NOT NULL, CONSTRAINT "UQ_47fbf6564e1450fa0c527f7fb78" UNIQUE ("engine_version_key"), CONSTRAINT "PK_78ce275dc827b0733a45c79d6a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "db_instance_class" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "availability_zone_id" integer NOT NULL, "engine_version_id" integer, CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_aws_security_group" ("rds_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_30edb9d50aef608d12995047c4e" PRIMARY KEY ("rds_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf5fdc058ec5db521f32d4d6dd" ON "rds_vpc_security_groups_aws_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b0d4af7000a31b4657220db78" ON "rds_vpc_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds" ADD CONSTRAINT "FK_88d7baba1011b1d780d4087e401" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rds" ADD CONSTRAINT "FK_f0c9a8ba920bd21d2f2833e1d92" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_7b0d4af7000a31b4657220db78e" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // Example of use: call create_rds('test-sp-sg', 50, 'db.t3.micro', 'postgres', '13.4', 'test', 'Alanus3r', 'eu-west-1a', array['default']);
        await queryRunner.query(`
            create or replace procedure create_rds(
                _name text,
                _allocated_storage integer,
                _db_instance_class text,
                _engine text,
                _engine_version text,
                _master_username text,
                _master_user_password text,
                _availability_zone_name text,
                _security_group_names text[] default null
            )
            language plpgsql
            as $$
                declare
                    rds_instance_id integer;
                    az_id integer;
                    ev_id integer;
                    sg record;
                begin
                    select id into ev_id
                    from engine_version
                    where engine = _engine and engine_version = _engine_version
                    order by id desc
                    limit 1;
            
                    assert ev_id > 0, 'No valid engine provided';
            
                    select id into az_id
                    from availability_zone
                    where zone_name = _availability_zone_name
                    order by id desc
                    limit 1;
            
                    assert az_id > 0, 'No valid availability zone provided';
            
                    insert into rds
                        (db_instance_identifier, allocated_storage, db_instance_class, master_user_password, master_username, availability_zone_id, engine_version_id)
                    values
                        (_name, _allocated_storage, _db_instance_class, _master_user_password, _master_username, az_id, ev_id)
                    on conflict (db_instance_identifier)
                    do nothing;
            
                    select id into rds_instance_id
                    from rds
                    where db_instance_identifier = _name
                    order by id desc
                    limit 1;
            
                    -- Security groups

                    for sg in
                        select id
                        from aws_security_group
                        where group_name = any(_security_group_names)
                    loop
                        insert into rds_vpc_security_groups_aws_security_group
                            (rds_id, aws_security_group_id)
                        values
                            (rds_instance_id, sg.id)
                        on conflict ON CONSTRAINT "PK_30edb9d50aef608d12995047c4e"
                        do nothing;
                    end loop;
            
                    raise info 'rds_instance_id = %', rds_instance_id;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure create_rds;`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_7b0d4af7000a31b4657220db78e"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_f0c9a8ba920bd21d2f2833e1d92"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_88d7baba1011b1d780d4087e401"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b0d4af7000a31b4657220db78"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf5fdc058ec5db521f32d4d6dd"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "rds"`);
        await queryRunner.query(`DROP TABLE "engine_version"`);
    }

}
