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
import { AvailabilityZone } from '../../aws_vpc/entity';
import { ParameterGroup } from './parameter_group';
import { SubnetGroup } from './subnet_group';

/**
 * @enum
 * The name of the database engine to be used for this DB cluster.
 */
export enum dbClusterEngineEnum {
  AURORA = 'aurora',
  AURORA_MYSQL = 'aurora-mysql',
  AURORA_POSTGRESQL = 'aurora-postgresql',
  MYSQL = 'MYSQL',
  POSTGRES = 'POSTGRES',
}

/**
 * Table to manage Aurora DB cluster instances. An Amazon Aurora DB cluster consists of one or more DB instances and a cluster volume
 * that manages the data for those DB instances. An Aurora cluster volume is a virtual database storage volume that
 * spans multiple Availability Zones, with each Availability Zone having a copy of the DB cluster data.
 *
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.html
 */
@Entity()
@Unique('UQ_identifier_region', ['dbClusterIdentifier', 'region'])
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
   * Only valid for multi-az DB cluster
   *
   * @privateRemarks
   * TODO: Add constraints? range vary based on storage type and engine
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  allocatedStorage?: number;

  /**
   * @public
   * Reference to the availability zones for the database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.RegionsAndAvailabilityZones.html
   */
  @ManyToOne(() => AvailabilityZone, { eager: true, nullable: false })
  @JoinColumn([
    {
      name: 'availability_zone',
      referencedColumnName: 'name',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  availabilityZone: AvailabilityZone;

  /**
   * @public
   * The number of days for which automated backups are retained.
   * Valid for: Aurora DB clusters and Multi-AZ DB clusters
   */
  @Column({
    type: 'int',
    nullable: true,
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
  @Column({
    nullable: true,
  })
  dbInstanceClass?: string;

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
  @ManyToOne(() => SubnetGroup, {
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
  subnetGroup?: SubnetGroup;

  /**
   * @public
   * The name for your database of up to 64 alphanumeric characters. If you do not provide a name, Amazon RDS doesn't create a database in the DB cluster you are creating.
   */
  @Column()
  @cloudId
  dbName: string;

  /**
   * @public
   * The name of the database engine to be used for this DB cluster.
   */
  @Column({ nullable: true, type: 'enum', enum: dbClusterEngineEnum })
  engine?: dbClusterEngineEnum;

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
  @Column({
    nullable: true,
  })
  masterUsername?: string;

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
    name: 'rds_security_groups',
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
