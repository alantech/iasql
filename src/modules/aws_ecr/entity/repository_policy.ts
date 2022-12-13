import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, Unique, ManyToOne } from 'typeorm';

import { Repository } from '.';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS ECR private repository policies. Amazon ECR uses resource-based permissions to control access to repositories.
 * Resource-based permissions let you specify which IAM users or roles have access to a repository and what actions they can perform on it.
 *
 * By default, only the AWS account that created the repository has access to a repository.
 * You can apply a policy document that allow additional permissions to your repository.
 *
 * @example
 * ```sql TheButton[Manage policies for an ECR repository]="Manage policies for an ECR repository"
 * INSERT INTO repository_policy (repository_id, policy_text) VALUES
 * ((select id from repository where repository_name = 'repository'),
 * '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}');
 *
 * SELECT * FROM repository_policy WHERE repository_id = (select id from repository where repository_name = 'repository');
 *
 * DELETE FROM repository_policy WHERE repository_id = (select id from repository where repository_name = 'repository');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L291
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html
 */
@Entity()
@Unique('uq_repository_policy_region', ['id', 'region'])
export class RepositoryPolicy {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Registry that is associated to the policy
   */
  @Column({
    nullable: true,
  })
  registryId?: string;

  /**
   * @public
   * Reference to the repository that is associated to the policy
   */
  @OneToOne(() => Repository, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'repository_id',
      referencedColumnName: 'id',
    },
    // we defined this one to make sure we are using the right region
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  repository: Repository;

  /**
   * @public
   * Text containing the policy for that repository
   * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policy-examples.html
   */
  @Column({
    nullable: true,
  })
  policyText?: string;

  /**
   * @public
   * Reference to the associated region
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
