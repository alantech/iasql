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
import { DBCluster } from './db_cluster';
import { ParameterGroup } from './parameter_group';

/**
 * Table to manage AWS RDS instances. Amazon Relational Database Service (Amazon RDS) is a web service that makes it easier to
 * set up, operate, and scale a relational database in the AWS Cloud.
 *
 * It provides cost-efficient, resizable capacity for an industry-standard relational database and manages common database administration tasks.
 *
 * @see https://aws.amazon.com/rds/
 */
@Entity()
@Unique('UQ_identifier_region', ['dbInstanceIdentifier', 'region'])
export class RDS {
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
  dbInstanceIdentifier: string;

  /**
   * @public
   * Amount of storage requested for the database
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage
   *
   * @privateRemarks
   * TODO: Add constraints? range vary based on storage type and engine
   */
  @Column({
    type: 'int',
  })
  allocatedStorage: number;

  /**
   * @public
   * Reference to the availability zones for the database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html
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
   * Class that represents the computation and memory capacity of an Amazon RDS DB instance
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html#Concepts.DBInstanceClass.Types
   *
   * @privateRemarks
   * TODO: make this an entity eventually?
   * @ManyToOne(() => DBInstanceClass, { eager: true, })
   * @JoinColumn({
   * . name: 'db_instance_class_id',
   * })
   */
  @Column()
  dbInstanceClass: string;

  /**
   * @public
   * Engine to use for the current database
   * @see https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-engine-versions.html
   */
  @Column()
  engine: string;

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
   * Master user password for the database
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masteruserpassword
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
   * Master username for the database
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masterusername
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
   * Address used to connect to the RDS database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
   *
   * @privateRemarks
   * TODO: make this an entity eventually?
   */
  @Column({
    nullable: true,
  })
  endpointAddr?: string;

  /**
   * @public
   * Port used to connect to the RDS database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
   *
   * @privateRemarks
   * TODO: make this an entity eventually?
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  endpointPort?: number;

  /**
   * @public
   * Hosted zone ID used to connect to the RDS database
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
   *
   * @privateRemarks
   * TODO: make this an entity eventually?
   */
  @Column({
    nullable: true,
  })
  endpointHostedZoneId?: string;

  /**
   * @public
   * Limit of days for keeping a database backup
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.Enabling
   */
  @Column({
    type: 'int',
    default: 1,
  })
  backupRetentionPeriod: number;

  /**
   * @public
   * List of the parameter groups associated with the database
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
   * DB cluster associated to the DB instance
   */
  @ManyToOne(() => DBCluster, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'db_cluster_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  dbCluster?: DBCluster;

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
