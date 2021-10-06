import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';
import { Source, source } from '../services/source-of-truth';
import { AMI } from './ami'
import { InstanceType } from './instance_type'
import { Region } from './region'
import { SecurityGroup } from './security_group';

// TODO complete instance schema
@source(Source.DB)
@Entity()
export class RDS {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    nullable: true
  })
  DBInstanceIdentifier?: string;

  @Column()
  Engine: string; enum

  null
  EngineVersion

  @Column()
  DBInstanceClass: string;

  @Column({
    nullable: true
  })
  DBInstanceStatus?: string;

  null
  MasterUsername?: string;

  null
  DBName?: string;

  Endpoint?: Endpoint;

  null
  AvailabilityZone

  DBInstanceClass // TODO entity, equivalent to instance type entity

  null
  DBSecurityGroups check if are the same sec groups

  null
  MultiAZ

  null
  Port

  null
  DBSubnetGroupName

  StorageType enum

  null
  VpcSecurityGroupIds

  @ManyToOne(() => AMI, { eager: true, })
  @JoinColumn({
    name: 'ami_id',
  })
  ami: AMI;

  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @ManyToOne(() => InstanceType, { eager: true, })
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceType: InstanceType;

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups: SecurityGroup[]
}

 /**
  * <p>Contains the master username for the DB instance.</p>
  */
 
 /**
  * <p>The meaning of this parameter differs according to the database engine you use.</p>
  *          <p>
  *             <b>MySQL, MariaDB, SQL Server, PostgreSQL</b>
  *          </p>
  *          <p>Contains the name of the initial database of this instance that was provided at create time, if one was specified when the DB instance was created. This same name is returned for the life of the DB instance.</p>
  *          <p>Type: String</p>
  *          <p>
  *             <b>Oracle</b>
  *          </p>
  *          <p>Contains the Oracle System ID (SID) of the created DB instance. Not shown when the returned parameters do not apply to an Oracle DB instance.</p>
  */
 
 /**
  * <p>Specifies the connection endpoint.</p>
  *          <note>
  *             <p>The endpoint might not be shown for instances whose status is <code>creating</code>.</p>
  *          </note>
  */
 
 /**
  * <p>Specifies the allocated storage size specified in gibibytes (GiB).</p>
  */
 AllocatedStorage?: number;
 /**
  * <p>Provides the date and time the DB instance was created.</p>
  */
 InstanceCreateTime?: Date;
 /**
  * <p>
  *         Specifies the daily time range during which automated backups are
  *         created if automated backups are enabled, as determined
  *         by the <code>BackupRetentionPeriod</code>.
  *         </p>
  */
 PreferredBackupWindow?: string;
 /**
  * <p>Specifies the number of days for which automatic DB snapshots are retained.</p>
  */
 BackupRetentionPeriod?: number;
 /**
  * <p>
  *         A list of DB security group elements containing
  *         <code>DBSecurityGroup.Name</code> and <code>DBSecurityGroup.Status</code> subelements.
  *         </p>
  */
 DBSecurityGroups?: DBSecurityGroupMembership[];
 /**
  * <p>Provides a list of VPC security group elements that the DB instance belongs to.</p>
  */
 VpcSecurityGroups?: VpcSecurityGroupMembership[];
 /**
  * <p>Provides the list of DB parameter groups applied to this DB instance.</p>
  */
 DBParameterGroups?: DBParameterGroupStatus[];
 /**
  * <p>Specifies the name of the Availability Zone the DB instance is located in.</p>
  */
 AvailabilityZone?: string;
 /**
  * <p>Specifies information on the subnet group associated with the DB instance, including the name, description, and subnets in the subnet group.</p>
  */
 DBSubnetGroup?: DBSubnetGroup;
 /**
  * <p>Specifies the weekly time range during which system maintenance can occur, in Universal Coordinated Time (UTC).</p>
  */
 PreferredMaintenanceWindow?: string;
 /**
  * <p>A value that specifies that changes to the DB instance are pending. This element is only included when changes are pending. Specific changes are identified by subelements.</p>
  */
 PendingModifiedValues?: PendingModifiedValues;
 /**
  * <p>Specifies the latest time to which a database can be restored with point-in-time restore.</p>
  */
 LatestRestorableTime?: Date;
 /**
  * <p>Specifies if the DB instance is a Multi-AZ deployment.</p>
  */
 MultiAZ?: boolean;
 /**
  * <p>Indicates the database engine version.</p>
  */
 EngineVersion?: string;
 /**
  * <p>A value that indicates that minor version patches are applied automatically.</p>
  */
 AutoMinorVersionUpgrade?: boolean;
 /**
  * <p>Contains the identifier of the source DB instance if this DB instance is a read
  *             replica.</p>
  */
 ReadReplicaSourceDBInstanceIdentifier?: string;
 /**
  * <p>Contains one or more identifiers of the read replicas associated with this DB
  *             instance.</p>
  */
 ReadReplicaDBInstanceIdentifiers?: string[];
 /**
  * <p>Contains one or more identifiers of Aurora DB clusters to which the RDS DB instance
  *             is replicated as a read replica. For example, when you create an Aurora read replica of
  *             an RDS MySQL DB instance, the Aurora MySQL DB cluster for the Aurora read replica is
  *             shown. This output does not contain information about cross region Aurora read
  *             replicas.</p>
  *         <note>
  *             <p>Currently, each RDS DB instance can have only one Aurora read replica.</p>
  *         </note>
  */
 ReadReplicaDBClusterIdentifiers?: string[];
 /**
  * <p>The open mode of an Oracle read replica. The default is <code>open-read-only</code>.
  *             For more information, see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-read-replicas.html">Working with Oracle Read Replicas for Amazon RDS</a>
  *             in the <i>Amazon RDS User Guide</i>.</p>
  *         <note>
  *             <p>This attribute is only supported in RDS for Oracle.</p>
  *         </note>
  */
 ReplicaMode?: ReplicaMode | string;
 /**
  * <p>License model information for this DB instance.</p>
  */
 LicenseModel?: string;
 /**
  * <p>Specifies the Provisioned IOPS (I/O operations per second) value.</p>
  */
 Iops?: number;
 /**
  * <p>Provides the list of option group memberships for this DB instance.</p>
  */
 OptionGroupMemberships?: OptionGroupMembership[];
 /**
  * <p>If present, specifies the name of the character set that this instance is associated with.</p>
  */
 CharacterSetName?: string;
 /**
  * <p>The name of the NCHAR character set for the Oracle DB instance. This character set specifies the
  *             Unicode encoding for data stored in table columns of type NCHAR, NCLOB, or NVARCHAR2.
  *         </p>
  */
 NcharCharacterSetName?: string;
 /**
  * <p>If present, specifies the name of the secondary Availability Zone for a DB instance with multi-AZ support.</p>
  */
 SecondaryAvailabilityZone?: string;
 /**
  * <p>Specifies the accessibility options for the DB instance.</p>
  *          <p>When the DB instance is publicly accessible, its DNS endpoint resolves to the private IP address from within the DB instance's VPC,
  *           and to the public IP address from outside of the DB instance's VPC. Access to the DB instance is ultimately controlled by the security group it uses,
  *           and that public access is not permitted if the security group assigned to the DB instance doesn't permit it.</p>
  *          <p>When the DB instance isn't publicly accessible, it is an internal DB instance with a DNS name that resolves to a private IP address.</p>
  *          <p>For more information, see <a>CreateDBInstance</a>.</p>
  */
 PubliclyAccessible?: boolean;
 /**
  * <p>The status of a read replica. If the instance isn't a read replica, this is
  *             blank.</p>
  */
 StatusInfos?: DBInstanceStatusInfo[];
 /**
  * <p>Specifies the storage type associated with DB instance.</p>
  */
 StorageType?: string;
 /**
  * <p>The ARN from the key store with which the instance is associated for TDE encryption.</p>
  */
 TdeCredentialArn?: string;
 /**
  * <p>Specifies the port that the DB instance listens on. If the DB instance is part of a DB cluster, this can be a different port than the DB cluster port.</p>
  */
 DbInstancePort?: number;
 /**
  * <p>If the DB instance is a member of a DB cluster, contains the name of the DB cluster that the DB instance is a member of.</p>
  */
 DBClusterIdentifier?: string;
 /**
  * <p>Specifies whether the DB instance is encrypted.</p>
  */
 StorageEncrypted?: boolean;
 /**
  * <p>
  *             If <code>StorageEncrypted</code> is true, the Amazon Web Services KMS key identifier
  *             for the encrypted DB instance.
  *         </p>
  *          <p>The Amazon Web Services KMS key identifier is the key ARN, key ID, alias ARN, or alias name for the Amazon Web Services KMS customer master key (CMK).</p>
  */
 KmsKeyId?: string;
 /**
  * <p>The Amazon Web Services Region-unique, immutable identifier for the DB instance. This identifier is found in Amazon Web Services CloudTrail log
  *           entries whenever the Amazon Web Services KMS customer master key (CMK) for the DB instance is accessed.</p>
  */
 DbiResourceId?: string;
 /**
  * <p>The identifier of the CA certificate for this DB instance.</p>
  */
 CACertificateIdentifier?: string;
 /**
  * <p>The Active Directory Domain membership records associated with the DB instance.</p>
  */
 DomainMemberships?: DomainMembership[];
 /**
  * <p>Specifies whether tags are copied from the DB instance to snapshots of the DB instance.</p>
  *          <p>
  *             <b>Amazon Aurora</b>
  *          </p>
  *          <p>Not applicable. Copying tags to snapshots is managed by the DB cluster. Setting this
  *             value for an Aurora DB instance has no effect on the DB cluster setting. For more
  *             information, see <code>DBCluster</code>.</p>
  */
 CopyTagsToSnapshot?: boolean;
 /**
  * <p>The interval, in seconds, between points when Enhanced Monitoring metrics are collected for the DB instance.</p>
  */
 MonitoringInterval?: number;
 /**
  * <p>The Amazon Resource Name (ARN) of the Amazon CloudWatch Logs log stream that receives the Enhanced Monitoring metrics data for the DB instance.</p>
  */
 EnhancedMonitoringResourceArn?: string;
 /**
  * <p>The ARN for the IAM role that permits RDS to send Enhanced Monitoring metrics to Amazon CloudWatch Logs.</p>
  */
 MonitoringRoleArn?: string;
 /**
  * <p>A value that specifies the order in which an Aurora Replica is promoted to the primary instance
  *       after a failure of the existing primary instance. For more information,
  *       see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Managing.Backups.html#Aurora.Managing.FaultTolerance">
  *           Fault Tolerance for an Aurora DB Cluster</a> in the <i>Amazon Aurora User Guide</i>.
  *     </p>
  */
 PromotionTier?: number;
 /**
  * <p>The Amazon Resource Name (ARN) for the DB instance.</p>
  */
 DBInstanceArn?: string;
 /**
  * <p>The time zone of the DB instance.
  *             In most cases, the <code>Timezone</code> element is empty.
  *             <code>Timezone</code> content appears only for
  *             Microsoft SQL Server DB instances
  *             that were created with a time zone specified.
  *         </p>
  */
 Timezone?: string;
 /**
  * <p>True if mapping of Amazon Web Services Identity and Access Management (IAM) accounts to database accounts is enabled, and otherwise false.</p>
  *
  *          <p>IAM database authentication can be enabled for the following database engines</p>
  *          <ul>
  *             <li>
  *                <p>For MySQL 5.6, minor version 5.6.34 or higher</p>
  *             </li>
  *             <li>
  *                <p>For MySQL 5.7, minor version 5.7.16 or higher</p>
  *             </li>
  *             <li>
  *                <p>Aurora 5.6 or higher. To enable IAM database authentication for Aurora, see DBCluster Type.</p>
  *             </li>
  *          </ul>
  */
 IAMDatabaseAuthenticationEnabled?: boolean;
 /**
  * <p>True if Performance Insights is enabled for the DB instance, and otherwise false.</p>
  */
 PerformanceInsightsEnabled?: boolean;
 /**
  * <p>The Amazon Web Services KMS key identifier for encryption of Performance Insights data.</p>
  *         <p>The Amazon Web Services KMS key identifier is the key ARN, key ID, alias ARN, or alias name for the Amazon Web Services KMS customer master key (CMK).</p>
  */
 PerformanceInsightsKMSKeyId?: string;
 /**
  * <p>The amount of time, in days, to retain Performance Insights data. Valid values are 7 or 731 (2 years). </p>
  */
 PerformanceInsightsRetentionPeriod?: number;
 /**
  * <p>A list of log types that this DB instance is configured to export to CloudWatch Logs.</p>
  *         <p>Log types vary by DB engine. For information about the log types for each DB engine, see
  *             <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_LogAccess.html">Amazon RDS Database Log Files</a> in the <i>Amazon RDS User Guide.</i>
  *          </p>
  */
 EnabledCloudwatchLogsExports?: string[];
 /**
  * <p>The number of CPU cores and the number of threads per core for the DB instance class of the DB instance.</p>
  */
 ProcessorFeatures?: ProcessorFeature[];
 /**
  * <p>Indicates if the DB instance has deletion protection enabled.
  *             The database can't be deleted when deletion protection is enabled.
  *             For more information, see
  *             <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html">
  *                 Deleting a DB Instance</a>.
  *         </p>
  */
 DeletionProtection?: boolean;
 /**
  * <p>
  *             The Amazon Web Services Identity and Access Management (IAM) roles associated with the DB instance.
  *         </p>
  */
 AssociatedRoles?: DBInstanceRole[];
 /**
  * <p>Specifies the listener connection endpoint for SQL Server Always On.</p>
  */
 ListenerEndpoint?: Endpoint;
 /**
  * <p>The upper limit in gibibytes (GiB) to which Amazon RDS can automatically scale the storage of the DB instance.</p>
  */
 MaxAllocatedStorage?: number;
 /**
  * <p>A list of tags.
  *           For more information, see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Tagging.html">Tagging Amazon RDS Resources</a> in the <i>Amazon RDS User Guide.</i>
  *          </p>
  */
 TagList?: Tag[];
 /**
  * <p>The list of replicated automated backups associated with the DB instance.</p>
  */
 DBInstanceAutomatedBackupsReplications?: DBInstanceAutomatedBackupsReplication[];
 /**
  * <p>Specifies whether a customer-owned IP address (CoIP) is enabled for an RDS on Outposts DB instance.</p>
  *         <p>A <i>CoIP </i>provides local or external connectivity to resources in
  *             your Outpost subnets through your on-premises network. For some use cases, a CoIP can
  *             provide lower latency for connections to the DB instance from outside of its virtual
  *             private cloud (VPC) on your local network.</p>
  *         <p>For more information about RDS on Outposts, see <a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-on-outposts.html">Working with Amazon RDS on Amazon Web Services Outposts</a>
  *             in the <i>Amazon RDS User Guide</i>.</p>
  *         <p>For more information about CoIPs, see <a href="https://docs.aws.amazon.com/outposts/latest/userguide/outposts-networking-components.html#ip-addressing">Customer-owned IP addresses</a>
  *             in the <i>Amazon Web Services Outposts User Guide</i>.</p>
  */
 CustomerOwnedIpEnabled?: boolean;
 /**
  * <p>The Amazon Resource Name (ARN) of the recovery point in Amazon Web Services Backup.</p>
  */
 AwsBackupRecoveryPointArn?: string;
 /**
  * <p>The status of the database activity stream.</p>
  */
 ActivityStreamStatus?: ActivityStreamStatus | string;
 /**
  * <p>The Amazon Web Services KMS key identifier used for encrypting messages in the database activity stream.
  *             The Amazon Web Services KMS key identifier is the key ARN, key ID, alias ARN, or alias name for the Amazon Web Services KMS
  *             customer master key (CMK).</p>
  */
 ActivityStreamKmsKeyId?: string;
 /**
  * <p>The name of the Amazon Kinesis data stream used for the database activity stream.</p>
  */
 ActivityStreamKinesisStreamName?: string;
 /**
  * <p>The mode of the database activity stream. Database events such as a change or access generate
  *             an activity stream event. RDS for Oracle always handles these events asynchronously.</p>
  */
 ActivityStreamMode?: ActivityStreamMode | string;
 /**
  * <p>Indicates whether engine-native audit fields are included in the database activity stream.</p>
  */
 ActivityStreamEngineNativeAuditFieldsIncluded?: boolean;