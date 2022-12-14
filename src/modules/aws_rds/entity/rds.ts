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

/**
 * Table to manage AWS RDS instances. Amazon Relational Database Service (Amazon RDS) is a web service that makes it easier to
 * set up, operate, and scale a relational database in the AWS Cloud.
 *
 * It provides cost-efficient, resizable capacity for an industry-standard relational database and manages common database administration tasks.
 *
 * @example
 * ```sql TheButton[Manage an RDS instance]="Manage an RDS instance"
 * INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
 * VALUES ('db_name', 20, 'db.t3.micro', 'test', 'testpass', (SELECT name FROM availability_zone WHERE region = 'us-east-1' LIMIT 1), 'postgres:13.4', 0);
 * SELECT * FROM rds WHERE db_instance_identifier = 'db_name';
 * DELETE FROM rds WHERE db_instance_identifier = 'db_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-rds-integration.ts#L93
 * @see https://aws.amazon.com/rds/
 */
@Entity()
@Unique('UQ_identifier_region', ['dbInstanceIdentifier', 'region'])
export class RDS {
  /**
   * @private
   * Auto-incremented ID field for EC2 instance
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
