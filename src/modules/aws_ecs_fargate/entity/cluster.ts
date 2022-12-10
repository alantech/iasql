import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS ECS clusters.
 *
 * @example
 * ```sql
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
   * Auto-incremented ID field for storing builds
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
