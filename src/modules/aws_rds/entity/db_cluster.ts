import {
  Check,
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
import { DBSubnetGroup } from './db_subnet_group';
import { ParameterGroup } from './parameter_group';

/**
 * @enum
 * The name of the database engine to be used for this DB cluster.
 */
export enum dbClusterEngineEnum {
  mysql = 'mysql',
  postgres = 'postgres',
}

/**
 * Table to manage Multi-AZ DB cluster instances. A Multi-AZ DB cluster deployment is a high availability
 * deployment mode of Amazon RDS with two readable standby DB instances. A Multi-AZ DB cluster has a writer
 * DB instance and two reader DB instances in three separate Availability Zones in the same AWS Region.
 * Multi-AZ DB clusters provide high availability, increased capacity for read workloads,
 * and lower write latency when compared to Multi-AZ DB instance deployments.
 *
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html
 */
@Entity()
@Unique('UQ_db_cluster_identifier_region', ['dbClusterIdentifier', 'region'])
@Unique('db_cluster_group_id_region', ['id', 'region']) // So the RDS entity can join on both
export class DBCluster {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the databae
   */
  @Column()
  @cloudId
  dbClusterIdentifier: string;

  /**
   * @public
   * The amount of storage in gibibytes (GiB) to allocate to each DB instance in the Multi-AZ DB cluster.
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#USER_PIOPS
   */
  @Check('Check_db_cluster_allocated_storage', `"allocated_storage">=100 AND "allocated_storage"<=65000`)
  @Column({
    type: 'int',
  })
  allocatedStorage: number;

  /**
   * @public
   * The number of I/O operations per second (IOPS)
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#USER_PIOPS
   */
  @Check('Check_db_cluster_iops', `"iops">=1000 AND "iops"<=256000`)
  @Column({
    type: 'int',
  })
  iops: number;

  /**
   * @public
   * The number of days for which automated backups are retained.
   */
  @Column({
    type: 'int',
    default: 1,
  })
  backupRetentionPeriod?: number;

  /**
   * @public
   * The compute and memory capacity of each DB instance in the Multi-AZ DB cluster.
   * Valid only for multi-az clusters.
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html
   *
   * @privateRemarks
   * TODO: make this an entity eventually?
   * @ManyToOne(() => DBInstanceClass, { eager: true, })
   * @JoinColumn({
   * . name: 'db_instance_class_id',
   * })
   */
  @Column()
  dbClusterInstanceClass: string;

  /**
   * @public
   * Parameter group associated with the DB cluster
   */
  @ManyToOne(() => ParameterGroup, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'parameter_group_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  parameterGroup?: ParameterGroup;

  /**
   * @public
   * Subnet group associated with the DB cluster
   */
  @ManyToOne(() => DBSubnetGroup, {
    eager: true,
    nullable: true,
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
  subnetGroup?: DBSubnetGroup;

  /**
   * @public
   * The name for your database of up to 64 alphanumeric characters. If you do not provide a name, Amazon RDS doesn't create a database in the DB cluster you are creating.
   */
  @Column({
    nullable: true,
  })
  databaseName?: string;

  /**
   * @public
   * A value that indicates whether the DB cluster has deletion protection enabled.
   */
  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  deletionProtection: boolean;

  /**
   * @public
   * The name of the database engine to be used for this DB cluster.
   */
  @Column({ type: 'enum', enum: dbClusterEngineEnum })
  engine?: dbClusterEngineEnum;

  /**
   * @public
   * The version number of the database engine to use.
   */
  @Column({
    nullable: true,
  })
  engineVersion?: string;

  /**
   * @public
   * The password for the master database user.
   *
   * @privateRemarks
   * How to handle this? It is used just for creation and if an update is needed. After creation / update the value is removed from db
   * TODO: Apply constraints?
   */
  @Column({
    nullable: true,
  })
  masterUserPassword?: string;

  /**
   * @public
   * The name of the master user for the DB cluster.
   *
   * @privateRemarks
   * TODO: Apply constraints?
   */
  @Column()
  masterUsername: string;

  /**
   * @public
   * The port number on which the instances in the DB cluster accept connections.
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  port?: number;

  /**
   * @public
   * A value that indicates whether the DB cluster is publicly accessible.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbclustercommandinput.html#publiclyaccessible
   */
  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  publiclyAccessible: boolean;

  /**
   * @public
   * A value that indicates whether the DB cluster is encrypted.
   */
  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  storageEncrypted: boolean;

  /**
   * @public
   * Reference to the VPC security groups for the database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
   *
   * @privateRemarks
   * TODO rename table
   */
  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'db_cluster_security_groups',
  })
  vpcSecurityGroups: SecurityGroup[];

  /**
   * @public
   * Region for the database
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
