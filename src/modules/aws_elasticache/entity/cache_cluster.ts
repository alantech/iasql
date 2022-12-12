import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Types of engines supported for Elasticache.
 * "memcahed" and "redis" are supported
 * @see https://aws.amazon.com/es/elasticache/redis-vs-memcached/
 */
export enum Engine {
  MEMCACHED = 'memcached',
  REDIS = 'redis',
}

/**
 * Table to manage ElastiCache clusters. A cluster is a collection of one or more cache nodes, all of which run an instance of the Redis
 * cache engine software. When you create a cluster, you specify the engine and version for all of the nodes to use.
 *
 * @example
 * ```sql
 * INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes) VALUES ('cluster_name', 'cache.t1.micro', 'redis', 1);
 * SELECT * FROM cache_cluster WHERE cluster_id='cluster_name';
 * DELETE FROM cache_cluster WHERE cluster_id = 'cluster_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elasticache-integration.ts#L146
 * @see https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/Clusters.html
 */
@Entity()
export class CacheCluster {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Internal AWS ID for the cluster
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  clusterId: string;

  /**
   * @public
   * Node type to use as a base for the cluster deployment
   * @see https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/CacheNodes.SupportedTypes.html
   * TODO: convert it to an independent table in the future
   */
  @Column({
    nullable: true,
  })
  nodeType: string;

  /**
   * @public
   * Engine to use for the cluster
   */
  @Column({
    type: 'enum',
    enum: Engine,
    default: Engine.REDIS,
  })
  engine: Engine;

  /**
   * @public
   * Number of nodes to deploy for this specific cluster
   * @see https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/cluster-create-determine-requirements.html
   */
  @Column({
    nullable: true,
  })
  numNodes?: number;

  /**
   * @public
   * Region for the cluster
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
