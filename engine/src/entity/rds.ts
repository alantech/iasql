import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import {
  ActivityStreamMode,
  AvailabilityZone,
  Tag,
  EngineVersion,
  DBParameterGroupStatus,
  DomainMembership,
  CloudwatchLogsExport,
  OptionGroupMembership,
  ProcessorFeature,
  Endpoint,
  SecurityGroup,
  DBSecurityGroup
} from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';
import { Source, source } from '../services/source-of-truth';
import { DBInstanceClass } from './db_instance_class';

export enum LicenseModel {
  LICENSE_INCLUDED = 'license-included',
  BRING_YOUR_OWN_LICENSE = 'bring-your-own-license',
  GENERAL_PUBLIC_LICENSE = 'general-public-license',
}

export enum StorageType {
  STANDARD = 'standard',
  GP2 = 'gp2',
  IO1 = 'io1',
}

export enum ActivityStreamStatus {
  STARTED = 'started',
  STARTING = 'starting',
  STOPPED = 'stopped',
  STOPPING = 'stopping',
}

export enum ReplicaMode {
  MOUNTED = "mounted",
  OPEN_READ_ONLY = "open-read-only"
}

export type MonitoringIntervals = 0 | 1 | 5 | 10 | 15 | 30 | 60;

@source(Source.DB)
@Entity()
export class RDS {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true
  })
  dbiResourceId?: string;

  // TODO: add constraints
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#dbinstanceidentifier
  @awsPrimaryKey
  @Column({
    unique: true,
  })
  dbInstanceIdentifier: string;

  // TODO: Add constraints? range vary based on storage type and engine
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage
  @Column({
    type: 'int',
  })
  allocatedStorage: number;

  @Column({
    nullable: true,
  })
  autoMinorVersionUpgrade?: boolean;

  @ManyToOne(() => AvailabilityZone, { eager: true, })
  @JoinColumn({
    name: 'availability_zone_id',
  })
  availabilityZone: AvailabilityZone;

  // TODO: Add constraints
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#backupretentionperiod
  @Column({
    default: 1,
    nullable: true,
  })
  backupRetentionPeriod?: number;

  @Column({
    nullable: true,
  })
  characterSetName?: string;

  @Column({
    default: false,
    nullable: true,
  })
  copyTagsToSnapshot?: boolean;

  // TODO: Update with FK to cluster entity once implemented
  @Column({
    nullable: true,
  })
  dbClusterIdentifier?: string;

  @ManyToOne(() => DBInstanceClass, { eager: true, })
  @JoinColumn({
    name: 'db_instance_class_id',
  })
  dbInstanceClass: DBInstanceClass;

  // TODO: Constraints per database engine?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#dbname
  @Column({
    nullable: true,
  })
  dbName?: string;

  @ManyToMany(() => DBParameterGroupStatus, { cascade: true, eager: true, })
  @JoinTable()
  dbParameterGroups?: DBParameterGroupStatus[];

  @noDiff
  @ManyToMany(() => DBSecurityGroup, { eager: true, })
  @JoinTable()
  dbSecurityGroups?: DBSecurityGroup[];

  @Column({
    nullable: true,
    default: false,
  })
  deletionProtection?: boolean;

  @ManyToMany(() => DomainMembership, { cascade: true, eager: true, })
  @JoinTable()
  domainMemberships?: DomainMembership[];

  @ManyToMany(() => CloudwatchLogsExport, { cascade: true, eager: true, })
  @JoinTable()
  enabledCloudwatchLogsExports?: CloudwatchLogsExport[];

  @Column({
    nullable: true,
  })
  enableCustomerOwnedIp?: boolean;

  @Column({
    nullable: true,
    default: false,
  })
  enableIAMDatabaseAuthentication?: boolean;

  @Column({
    nullable: true,
  })
  enablePerformanceInsights?: boolean;

  @ManyToOne(() => EngineVersion, { eager: true, })
  @JoinColumn({
    name: 'engine_version_id'
  })
  engine: EngineVersion;

  // TODO: Add constraints?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#iops
  @Column({
    nullable: true,
  })
  iops?: number;

  @Column({
    nullable: true,
  })
  kmsKeyId?: string;

  @Column({
    nullable: true,
  })
  licenseModel?: LicenseModel;

  // ? How to handle this just for creation time and do not store it in DB?
  // TODO: Apply constraints?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masteruserpassword
  @noDiff
  @Column({
    nullable: true,
  })
  masterUserPassword?: string;

  // TODO: Apply constraints?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masterusername
  @Column({
    nullable: true,
  })
  masterUsername?: string;

  @Column({
    nullable: true,
  })
  maxAllocatedStorage?: number;

  // TODO: add constraint If MonitoringRoleArn is specified, then you must also set MonitoringInterval to a value other than 0.??
  @Column({
    default: 0,
  })
  monitoringInterval: MonitoringIntervals;

  @Column({
    nullable: true,
  })
  monitoringRoleArn?: string;

  @Column({
    nullable: true,
  })
  multiAZ?: boolean;

  // Just for oracle
  @Column({
    nullable: true,
  })
  ncharCharacterSetName?: string;

  @ManyToMany(() => OptionGroupMembership, { cascade: true, eager: true, })
  @JoinTable()
  optionGroupMemberships?: OptionGroupMembership[];

  @Column({
    nullable: true,
  })
  performanceInsightsKMSKeyId?: string;

  @Column({
    nullable: true,
  })
  performanceInsightsRetentionPeriod?: number;

  // TODO: add constraint per engine?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#port
  @Column({
    nullable: true,
  })
  port?: number;

  // TODO: add constraint?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#preferredbackupwindow
  @Column({
    nullable: true,
  })
  preferredBackupWindow?: string;

  // TODO: add constraint?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#preferredmaintenancewindow
  @Column({
    nullable: true,
  })
  preferredMaintenanceWindow?: string;

  @ManyToMany(() => ProcessorFeature, { cascade: true, eager: true, })
  @JoinTable()
  processorFeatures?: ProcessorFeature[];

  // TODO: constraint 0 - 15
  @Column({
    nullable: true,
    default: 1,
  })
  promotionTier?: number;

  @Column({
    nullable: true,
  })
  publiclyAccessible?: boolean;

  @Column({
    nullable: true,
  })
  storageEncrypted?: boolean;

  @Column({
    nullable: true,
    type: 'enum',
    enum: StorageType,
  })
  storageType?: StorageType;

  @ManyToMany(() => Tag, { cascade: true, eager: true, })
  @JoinTable()
  tags: Tag[];

  @Column({
    nullable: true,
  })
  tdeCredentialArn?: string;

  // ? how to handle this for creation
  @Column({
    nullable: true,
  })
  tdeCredentialPassword?: string;

  @Column({
    nullable: true,
  })
  timezone?: string;

  @noDiff
  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable()
  vpcSecurityGroups: SecurityGroup[];

  // ? enum all statuses?
  // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/accessing-monitoring.html#Overview.DBInstance.Status
  @Column({
    nullable: true,
  })
  dbInstanceStatus?: string;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  automaticRestartTime?: Date;

  @ManyToOne(() => Endpoint, { cascade: true, eager: true, })
  @JoinColumn({
    name: 'endpoint_id'
  })
  endpoint?: Endpoint;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  instanceCreateTime?: Date;

  // TODO: update using subnet group entity
  @Column({
    nullable: true,
  })
  dbSubnetGroup?: string;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  latestRestorableTime?: Date;

  // Only defined for MultiAZ
  @ManyToOne(() => AvailabilityZone, { eager: true, })
  @JoinColumn({
    name: 'secondary_availability_zone_id',
  })
  secondaryAvailabilityZone: AvailabilityZone;

  @Column({
    nullable: true,
  })
  caCertificateIdentifier?: string;

  @Column({
    nullable: true,
  })
  dbInstanceArn?: string;

  // TODO: update using DBInstanceRole entity
  @Column({
    nullable: true,
  })
  associatedRoles?: string;

  // SQL server only
  @ManyToOne(() => Endpoint, { cascade: true, eager: true, })
  @JoinColumn({
    name: 'listener_endpoint_id',
  })
  listenerEndpoint?: Endpoint;

  @Column({
    nullable: true,
  })
  awsBackupRecoveryPointArn?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ActivityStreamStatus,
  })
  activityStreamStatus?: ActivityStreamStatus;

  @ManyToOne(() => ActivityStreamMode, { eager: true, })
  @JoinColumn({
    name: 'activity_stream_mode_id',
  })
  activityStreamMode?: ActivityStreamMode;

  @Column({
    nullable: true,
  })
  activityStreamKmsKeyId?: string;

  @Column({
    nullable: true,
  })
  activityStreamKinesisStreamName?: string;

  @Column({
    nullable: true,
  })
  activityStreamEngineNativeAuditFieldsIncluded?: boolean;

  @Column({
    nullable: true,
  })
  readReplicaSourceDBInstanceIdentifier?: string;

  // TODO: create sub entity with many relationship
  @Column({
    nullable: true,
  })
  readReplicaDBInstanceIdentifiers?: string;

  // TODO: create sub entity with many relationship
  @Column({
    nullable: true,
  })
  readReplicaDBClusterIdentifiers?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ReplicaMode,
  })
  replicaMode?: ReplicaMode;

  // TODO: create sub entity with many relationship
  @Column({
    nullable: true,
  })
  statusInfos?: string;

  // TODO: create sub entity with many relationship
  @Column({
    nullable: true,
  })
  dbInstanceAutomatedBackupsReplications?: string;
}
