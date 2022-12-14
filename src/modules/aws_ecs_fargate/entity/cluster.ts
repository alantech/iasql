import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS ECS clusters. AWS Fargate is a technology that you can use with Amazon ECS to run containers
 * without having to manage servers or clusters of Amazon EC2 instances.
 *
 * An Amazon ECS cluster is a logical grouping of tasks or services. Your tasks and services are run on infrastructure that is registered to a cluster.
 * The infrastructure capacity can be provided by AWS Fargate, which is serverless infrastructure that AWS manages, Amazon EC2 instances that you manage,
 * or an on-premise server or virtual machine (VM) that you manage remotely.
 *
 * @example
 * ```sql TheButton[Manage an ECS cluster]="Manage an ECS cluster"
 * INSERT INTO cluster (cluster_name) VALUES('cluster_name');
 * SELECT * FROM cluster WHERE cluster_name = 'cluster_name';
 * DELETE FROM cluster WHERE cluster_name = 'cluster_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L198
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/clusters.html
 */
@Entity()
@Unique('uq_cluster_name_region', ['clusterName', 'region'])
export class Cluster {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name of the cluster
   */
  @Column({ nullable: false })
  clusterName: string;

  /**
   * @public
   * AWS ARN identifier for the cluster
   */
  @Column({
    nullable: true,
  })
  @cloudId
  clusterArn?: string;

  /**
   * @public
   * Current status of the cluster
   */
  @Column({
    nullable: true,
  })
  clusterStatus?: string;

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
