import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { SecurityGroup } from '../../aws_security_group/entity';
import { SubnetGroup } from './subnet_group';

/**
 * @enum
 * Different types of nodes supported by Memory DB
 * @see https://docs.aws.amazon.com/memorydb/latest/devguide/nodes.supportedtypes.html
 */
export enum NodeTypeEnum {
  db_t4g_small = 'db.t4g.small',
  db_t4g_medium = 'db.t4g.medium',
  db_r6g_large = 'db.r6g.large',
  db_r6g_xlarge = 'db.r6g.xlarge',
  db_r6g_2xlarge = 'db.r6g.2xlarge',
  db_r6g_4xlarge = 'db.r6g.4xlarge',
  db_r6g_8xlarge = 'db.r6g.8xlarge',
  db_r6g_12xlarge = 'db.r6g.12xlarge',
  db_r6g_16xlarge = 'db.r6g.16xlarge',
}

/**
 * Table to manage Memory DB clusters
 *
 * @example
 * ```sql
 * INSERT INTO memory_db_cluster (cluster_name, subnet_group_id) VALUES ('cluster_name', (select id from subnet_group where subnet_group_name = 'subnet_name'));
 * SELECT * FROM memory_db_cluster WHERE cluster_name = 'cluster_name';
 * DELETE FROM memory_db_cluster WHERE cluster_name = 'cluster_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-memory-db-integration.ts#L185
 * @see https://docs.aws.amazon.com/memorydb/latest/devguide/clusters.html
 */
@Entity()
@Unique('uq_memory_db_cluster_id_region', ['id', 'region'])
@Unique('uq_memory_db_cluster_name_region', ['clusterName', 'region'])
export class MemoryDBCluster {
  /**
   * @private
   * Auto-incremented ID field for cluster
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the cluster
   */
  @Column()
  @cloudId
  clusterName: string;

  /**
   * @public
   * Description for the cluster
   */
  @Column({ nullable: true })
  description?: string;

  /**
   * @public
   * Address for the memory db cluster
   * @see https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html
   */
  @Column({ nullable: true })
  address?: string;

  /**
   * @public
   * Port for the memory db cluster
   * @see https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html
   */
  @Column({ type: 'int', default: 6379 })
  port: number;

  /**
   * @public
   * Node type used for the nodes of the cluster
   */
  @Column({
    type: 'enum',
    enum: NodeTypeEnum,
    default: NodeTypeEnum.db_r6g_large,
  })
  nodeType: NodeTypeEnum;

  /**
   * @public
   * Reference to the security groups associated with the cluster
   * @see https://docs.aws.amazon.com/memorydb/latest/devguide/memorydb-vpc-accessing.html
   */
  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'memory_db_cluster_security_groups',
    joinColumns: [
      { name: 'memory_db_cluster_id', referencedColumnName: 'id' },
      { name: 'region', referencedColumnName: 'region' },
    ],
    inverseJoinColumns: [{ name: 'security_group_id', referencedColumnName: 'id' }],
  })
  securityGroups?: SecurityGroup[];

  /**
   * @public
   * Reference to the subnet groups associated with the cluster
   * @see https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html
   */
  @ManyToOne(() => SubnetGroup, subnetGroup => subnetGroup.subnetGroupName, {
    nullable: false,
    eager: true,
  })
  @JoinColumn([
    {
      name: 'subnet_group_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  subnetGroup: SubnetGroup;

  /**
   * @public
   * AWS ARN to identify the cluster
   */
  @Column({ nullable: true })
  arn?: string;

  /**
   * @public
   * Current status of the cluster
   * todo: enum?
   */
  @Column({ nullable: true })
  status?: string;

  /**
   * @public
   * Complex type to provide identifier tags for the cluster
   * @see https://docs.aws.amazon.com/memorydb/latest/devguide/tagging-resources.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
