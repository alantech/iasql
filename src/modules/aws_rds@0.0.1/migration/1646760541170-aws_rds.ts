import {MigrationInterface, QueryRunner} from "typeorm";

export class awsRds1646760541170 implements MigrationInterface {
    name = 'awsRds1646760541170'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" DROP CONSTRAINT "UQ_rule"`);
        await queryRunner.query(`CREATE TABLE "rds" ("id" SERIAL NOT NULL, "db_instance_identifier" character varying NOT NULL, "allocated_storage" integer NOT NULL, "availability_zone" character varying NOT NULL, "db_instance_class" character varying NOT NULL, "engine" character varying NOT NULL, "master_user_password" character varying, "master_username" character varying, "endpoint_addr" character varying, "endpoint_port" integer, "endpoint_hosted_zone_id" character varying, "backup_retention_period" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_7fb01956cebcabd694baf5f1f6b" UNIQUE ("db_instance_identifier"), CONSTRAINT "PK_67d6c2133366c8eda49b40de7b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rds_vpc_security_groups_aws_security_group" ("rds_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_30edb9d50aef608d12995047c4e" PRIMARY KEY ("rds_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bf5fdc058ec5db521f32d4d6dd" ON "rds_vpc_security_groups_aws_security_group" ("rds_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b0d4af7000a31b4657220db78" ON "rds_vpc_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0" FOREIGN KEY ("rds_id") REFERENCES "rds"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" ADD CONSTRAINT "FK_7b0d4af7000a31b4657220db78e" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // Example of use: call create_or_update_rds('test-sp-sg', 50, 'db.t3.micro', 'postgres', '13.4', 'test', 'Alanus3r', 'eu-west-1a', array['default']);
        await queryRunner.query(`
            create or replace procedure create_or_update_rds(
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
                    sg record;
                begin
                    insert into rds
                        (db_instance_identifier, allocated_storage, db_instance_class, master_user_password, master_username, availability_zone, engine)
                    values
                        (_name, _allocated_storage, _db_instance_class, _master_user_password, _master_username, _availability_zone_name, _engine || ':' || _engine_version)
                    on conflict (db_instance_identifier)
                    do update set allocated_storage = _allocated_storage,
                        db_instance_class = _db_instance_class,
                        master_user_password = _master_user_password,
                        master_username = _master_username,
                        availability_zone = _availability_zone_name,
                        engine = _engine || ':' || _engine_version;
            
                    select id into rds_instance_id
                    from rds
                    where db_instance_identifier = _name
                    order by id desc
                    limit 1;

                    for sg in
                        select id
                        from aws_security_group
                        where group_name = any(_security_group_names)
                    loop
                        insert into rds_vpc_security_groups_aws_security_group
                            (rds_id, aws_security_group_id)
                        values
                            (rds_instance_id, sg.id)
                        on conflict do nothing;
                    end loop;

                    delete from rds_vpc_security_groups_aws_security_group
                    using aws_security_group
                    where rds_id = rds_instance_id and aws_security_group.id = rds_vpc_security_groups_aws_security_group.aws_security_group_id and not (group_name = any(_security_group_names));
            
                    raise info 'rds_instance_id = %', rds_instance_id;
                end;
            $$;
        `);
        // Example of use: call delete_rds('test-sp-sg');
        await queryRunner.query(`
            create or replace procedure delete_rds(_name text)
            language plpgsql
            as $$
                begin
                    delete
                    from rds
                    where db_instance_identifier = _name;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure delete_rds;`);
        await queryRunner.query(`DROP procedure create_or_update_rds;`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_7b0d4af7000a31b4657220db78e"`);
        await queryRunner.query(`ALTER TABLE "rds_vpc_security_groups_aws_security_group" DROP CONSTRAINT "FK_bf5fdc058ec5db521f32d4d6dd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b0d4af7000a31b4657220db78"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf5fdc058ec5db521f32d4d6dd"`);
        await queryRunner.query(`DROP TABLE "rds_vpc_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP TABLE "rds"`);
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" ADD CONSTRAINT "UQ_rule" UNIQUE ("is_egress", "ip_protocol", "from_port", "to_port", "cidr_ipv4", "security_group_id")`);
    }

}
