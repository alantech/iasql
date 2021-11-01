import { MigrationInterface, QueryRunner } from "typeorm";

export class ecrPolicySp1635769143855 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Example of use: select * from create_ecr_repository_policy('sp-test', '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : "arn:aws:iam::257682470237:user/automate" }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}	');
    await queryRunner.query(`
      create or replace function create_ecr_repository_policy(
        _repository_name text,
        _policy_text text
      ) returns integer as $$ 
        declare 
          ecr_repository_id integer;
          ecr_repository_policy_id integer;
        begin
        
        select id into ecr_repository_id
        from repository
        where repository_name = _repository_name
        order by id desc
        limit 1;
      
        insert into repository_policy
          (
            repository_name,
            repository_id,
            policy_text
          )
        values
          (
            _repository_name,
            ecr_repository_id,
            _policy_text
          );
      
        select id into ecr_repository_policy_id
        from repository_policy
        order by id desc
        limit 1;
      
        return ecr_repository_policy_id;
        end; $$ language plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP function create_ecr_repository_policy;`);
  }

}
