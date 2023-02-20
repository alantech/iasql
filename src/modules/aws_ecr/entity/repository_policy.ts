import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, Unique, ManyToOne } from 'typeorm';

import { Repository } from '.';
import { Policy } from '../../../services/canonical-iam-policy';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS ECR private repository policies. Amazon ECR uses resource-based permissions to control access to repositories.
 * Resource-based permissions let you specify which IAM users or roles have access to a repository and what actions they can perform on it.
 *
 * By default, only the AWS account that created the repository has access to a repository.
 * You can apply a policy document that allow additional permissions to your repository.
 *
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html
 */
@Entity()
@Unique('uq_repository_policy_region', ['id', 'region'])
export class RepositoryPolicy {
  /**
   * @private
   * Auto-incremented ID field
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
    type: 'json',
  })
  policy?: Policy;

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
