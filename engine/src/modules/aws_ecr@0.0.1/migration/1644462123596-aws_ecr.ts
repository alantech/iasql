import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEcr1644462123596 implements MigrationInterface {
    name = 'awsEcr1644462123596'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "aws_public_repository" ("id" SERIAL NOT NULL, "repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_82f57b1a7d11d10dc93b7139d3a" UNIQUE ("repository_name"), CONSTRAINT "PK_95df151032108b7144e8013ba4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."aws_repository_image_tag_mutability_enum" AS ENUM('IMMUTABLE', 'MUTABLE')`);
        await queryRunner.query(`CREATE TABLE "aws_repository" ("id" SERIAL NOT NULL, "repository_name" character varying NOT NULL, "repository_arn" character varying, "registry_id" character varying, "repository_uri" character varying, "created_at" TIMESTAMP WITH TIME ZONE, "image_tag_mutability" "public"."aws_repository_image_tag_mutability_enum" NOT NULL DEFAULT 'MUTABLE', "scan_on_push" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_31c92f2fb5f203bdb05ada24d7a" UNIQUE ("repository_name"), CONSTRAINT "PK_06daa56b29fd9c69b862f276565" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "aws_repository_policy" ("id" SERIAL NOT NULL, "registry_id" character varying, "policy_text" character varying, "repository_id" integer NOT NULL, CONSTRAINT "REL_8d4c5993e3cea3212a32ade4b4" UNIQUE ("repository_id"), CONSTRAINT "PK_e05f9b7b2b063e0b1e11d6400b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "aws_repository_policy" ADD CONSTRAINT "FK_8d4c5993e3cea3212a32ade4b41" FOREIGN KEY ("repository_id") REFERENCES "aws_repository"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // TODO: Check these
        // Example of use: call create_ecr_repository('sp-test');
        await queryRunner.query(`
            create or replace procedure create_ecr_repository(_name text, _scan_on_push boolean default false, _image_tag_mutability aws_repository_image_tag_mutability_enum default 'MUTABLE')
            language plpgsql
            as $$
                declare
                    ecr_repository_id integer;
                begin
                    insert into aws_repository
                        (repository_name, scan_on_push, image_tag_mutability)
                    values
                        (_name, _scan_on_push, _image_tag_mutability)
                    on conflict (repository_name)
                    do nothing;

                    select id into ecr_repository_id
                    from aws_repository
                    where repository_name = _name
                    order by id desc
                    limit 1;

                    raise info 'repository_id = %', ecr_repository_id;
                end;
            $$;
        `);
        // Example of use: call create_ecr_repository_policy('sp-test', '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : "arn:aws:iam::257682470237:user/automate" }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}	');
        await queryRunner.query(`
            create or replace procedure create_ecr_repository_policy(
                _repository_name text,
                _policy_text text
            )
            language plpgsql
            as $$ 
                declare 
                    ecr_repository_id integer;
                    ecr_repository_policy_id integer;
                begin
                    select id into ecr_repository_id
                    from aws_repository
                    where repository_name = _repository_name
                    order by id desc
                    limit 1;
                
                    insert into aws_repository_policy
                        (repository_id, policy_text)
                    values
                        (ecr_repository_id, _policy_text)
                    on conflict ON CONSTRAINT "REL_8d4c5993e3cea3212a32ade4b4"
                    do nothing;
                
                    select id into ecr_repository_policy_id
                    from aws_repository_policy
                    where repository_id = ecr_repository_id
                    order by id desc
                    limit 1;
                
                    raise info 'repository_policy_id = %', ecr_repository_policy_id;
                end;
            $$;
        `);
        // Example of use: call create_ecr_public_repository('sp-test');
        await queryRunner.query(`
            create or replace procedure create_ecr_public_repository(_name text)
            language plpgsql
            as $$
                declare
                    ecr_pub_repository_id integer;
                begin
                    insert into aws_public_repository
                        (repository_name)
                    values
                        (_name)
                    on conflict (repository_name)
                    do nothing;

                    select id into ecr_pub_repository_id
                    from aws_public_repository
                    where repository_name = _name
                    order by id desc
                    limit 1;

                    raise info 'public_repository_id = %', ecr_pub_repository_id;
                end;
            $$;
        `);
        // Example of use: call delete_ecr_repository('sp-test');
        await queryRunner.query(`
            create or replace procedure delete_ecr_repository(_name text)
            language plpgsql
            as $$
                begin
                    delete
                    from aws_repository
                    where repository_name = _name;
                end;
            $$;
        `);
        // Example of use: call delete_ecr_repository_policy('sp-test');
        await queryRunner.query(`
            create or replace procedure delete_ecr_repository_policy(_repository_name text)
            language plpgsql
            as $$ 
                declare 
                    ecr_repository_id integer;
                begin
                    select id into ecr_repository_id
                    from aws_repository
                    where repository_name = _repository_name
                    order by id desc
                    limit 1;
                
                    delete
                    from aws_repository_policy
                    where repository_id = ecr_repository_id;
                end;
            $$;
        `);
        // Example of use: call delete_ecr_public_repository('sp-test');
        await queryRunner.query(`
            create or replace procedure delete_ecr_public_repository(_name text)
            language plpgsql
            as $$
                declare
                    ecr_pub_repository_id integer;
                begin
                    delete
                    from aws_public_repository
                    where repository_name = _name;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure delete_ecr_public_repository;`);
        await queryRunner.query(`DROP procedure delete_ecr_repository_policy;`);
        await queryRunner.query(`DROP procedure delete_ecr_repository;`);
        await queryRunner.query(`DROP procedure create_ecr_public_repository;`);
        await queryRunner.query(`DROP procedure create_ecr_repository_policy;`);
        await queryRunner.query(`DROP procedure create_ecr_repository;`);
        await queryRunner.query(`ALTER TABLE "aws_repository_policy" DROP CONSTRAINT "FK_8d4c5993e3cea3212a32ade4b41"`);
        await queryRunner.query(`DROP TABLE "aws_repository_policy"`);
        await queryRunner.query(`DROP TABLE "aws_repository"`);
        await queryRunner.query(`DROP TYPE "public"."aws_repository_image_tag_mutability_enum"`);
        await queryRunner.query(`DROP TABLE "aws_public_repository"`);
    }

}
