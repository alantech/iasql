import {MigrationInterface, QueryRunner} from "typeorm";

export class awsSecurityGroup1636587967230 implements MigrationInterface {
    name = 'awsSecurityGroup1636587967230'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_security_group" ("id" SERIAL NOT NULL, "description" character varying, "group_name" character varying, "owner_id" character varying, "group_id" character varying, "vpc_id" character varying, CONSTRAINT "PK_c95f0d51761dbddd9c3950d75be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_security_group_rule" ("id" SERIAL NOT NULL, "security_group_rule_id" character varying, "is_egress" boolean NOT NULL, "ip_protocol" character varying NOT NULL, "from_port" integer, "to_port" integer, "cidr_ipv4" cidr, "cidr_ipv6" cidr, "prefix_list_id" character varying, "description" character varying, "security_group_id" integer, CONSTRAINT "PK_e9776ba4916babd78e029b421e4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" ADD CONSTRAINT "FK_6d3482619216803d2f14ecf609d" FOREIGN KEY ("security_group_id") REFERENCES "aws_security_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // Example of use: call create_or_update_aws_security_group('test', 'test', '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": "8088", "toPort": 8088, "cidrIpv4": "0.0.0.0/0"}]', 'vpc');
        await queryRunner.query(`
            create or replace procedure create_or_update_aws_security_group(
                _name text,
                _description text,
                _secutiry_group_rules jsonb default null,
                _vpc_id text default null
            ) 
            language plpgsql
            as $$ 
                declare
                    security_group_id integer;
                    json_rule jsonb;
                begin
                    if _vpc_id is null then
                        select 'default' into _vpc_id;
                    end if;
            
                    insert into aws_security_group
                         (group_name, vpc_id, description)
                     values
                         (_name, _vpc_id, _description)
                     on conflict (group_name)
                     do update set vpc_id = _vpc_id, description = _description;

                    select id into security_group_id
                    from aws_security_group
                    where group_name = _name
                    order by id desc
                    limit 1;
            
                    -- TODO: Handle better rules update
                    delete from aws_security_group_rule
                    where security_group_id = security_group_id;
                    if jsonb_array_length(_secutiry_group_rules) > 0 then
                        for json_rule in
                            select * from jsonb_array_elements(_secutiry_group_rules)
                        loop
                            assert json_rule ?& array['isEgress', 'ipProtocol', 'fromPort', 'toPort', 'cidrIpv4'], 'Not all security group rule required keys are defined ("isEgress", "ipProtocol", "fromPort", "toPort", "cidrIpv4")';
        
                            insert into aws_security_group_rule
                                (security_group_id, is_egress, ip_protocol, from_port, to_port, cidr_ipv4)
                            values
                                (security_group_id, cast(json_rule ->> 'isEgress' as boolean), json_rule ->> 'ipProtocol', cast(json_rule ->> 'fromPort' as integer), cast(json_rule ->> 'toPort' as integer), cast(json_rule ->> 'cidrIpv4' as cidr));
                        end loop;
                    end if;
            
                    raise info 'aws_security_group_id = %', security_group_id;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure "create_or_update_aws_security_group";`);
        await queryRunner.query(`ALTER TABLE "aws_security_group_rule" DROP CONSTRAINT "FK_6d3482619216803d2f14ecf609d"`);
        await queryRunner.query(`DROP TABLE "aws_security_group_rule"`);
        await queryRunner.query(`DROP TABLE "aws_security_group"`);
    }

}
