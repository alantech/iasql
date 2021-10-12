import { DBInstance, } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { RDS, } from '../entity/rds'
import {
  ActivityStreamModeMapper,
  AvailabilityZoneMapper,
  CloudwatchLogsExportMapper,
  DBInstanceClassMapper,
  DBParameterGroupStatusMapper,
  DBSecurityGroupMembershipMapper,
  DomainMembershipMapper,
  EndpointMapper,
  EngineVersionMapper,
  OptionGroupMembershipMapper,
  ProcessorFeatureMapper,
  SecurityGroupMembershipMapper,
  TagMapper,
} from '.'
import { AvailabilityZone, EngineVersion, } from '../entity'
import { DepError } from '../services/lazy-dep'

export const RDSMapper: EntityMapper = new EntityMapper(RDS, {
  dbiResourceId: (dbi: DBInstance) => dbi?.DbiResourceId ?? null,
  dbInstanceIdentifier: (dbi: DBInstance) => dbi?.DBInstanceIdentifier,
  allocatedStorage: (dbi: DBInstance) => dbi?.AllocatedStorage,
  autoMinorVersionUpgrade: (dbi: DBInstance) => dbi?.AutoMinorVersionUpgrade ?? null,
  availabilityZone: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => {
    if (dbi?.AvailabilityZone) {
      const azEntity = await i.getOr(AvailabilityZone, dbi.AvailabilityZone, awsClient.getAvailabilityZoneByName.bind(awsClient));
      return await AvailabilityZoneMapper.fromAWS(azEntity, awsClient, i);
    } else {
      return null;
    }
  },
  backupRetentionPeriod: (dbi: DBInstance) => dbi?.BackupRetentionPeriod ?? null,
  characterSetName: (dbi: DBInstance) => dbi?.CharacterSetName ?? null,
  copyTagsToSnapshot: (dbi: DBInstance) => dbi?.CopyTagsToSnapshot ?? null,
  dbClusterIdentifier: (dbi: DBInstance) => dbi?.DBClusterIdentifier ?? null,
  dbInstanceClass: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => await DBInstanceClassMapper.fromAWS(dbi.DBInstanceClass, awsClient, i),
  dbName: (dbi: DBInstance) => dbi?.DBName ?? null,
  dbParameterGroups: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.DBParameterGroups?.length ?
      await Promise.all(dbi.DBParameterGroups.map(pgs => DBParameterGroupStatusMapper.fromAWS(pgs, awsClient, i)))
      : [],
  dbSecurityGroups: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.DBSecurityGroups?.length ?
      await Promise.all(dbi.DBSecurityGroups.map(sgm => DBSecurityGroupMembershipMapper.fromAWS(sgm, awsClient, i)))
      : [],
  deletionProtection: (dbi: DBInstance) => dbi?.DeletionProtection ?? null,
  domainMemberships: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi.DomainMemberships?.length ?
      await Promise.all(dbi.DomainMemberships.map(dm => DomainMembershipMapper.fromAWS(dm, awsClient, i)))
      : [],
  enabledCloudwatchLogsExports: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.EnabledCloudwatchLogsExports?.length ?
      await Promise.all(dbi.EnabledCloudwatchLogsExports.map(n => CloudwatchLogsExportMapper.fromAWS(n, awsClient, i)))
      : [],
  enableCustomerOwnedIp: (dbi: DBInstance) => dbi?.CustomerOwnedIpEnabled ?? null,
  enableIAMDatabaseAuthentication: (dbi: DBInstance) => dbi?.IAMDatabaseAuthenticationEnabled ?? null,
  enablePerformanceInsights: (dbi: DBInstance) => dbi?.PerformanceInsightsEnabled ?? null,
  engine: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => {
    const engineEntity = await i.getOr(EngineVersion, dbi.EngineVersion!, awsClient.getEngineVersion.bind(awsClient));
    return await EngineVersionMapper.fromAWS(engineEntity, awsClient, i)
  },
  iops: (dbi: DBInstance) => dbi?.Iops ?? null,
  kmsKeyId: (dbi: DBInstance) => dbi?.KmsKeyId ?? null,
  licenseModel: (dbi: DBInstance) => dbi?.LicenseModel ?? null,
  masterUsername: (dbi: DBInstance) => dbi?.MasterUsername ?? null,
  masterUserPassword: (_dbi: DBInstance) => null,
  maxAllocatedStorage: (dbi: DBInstance) => dbi?.MaxAllocatedStorage ?? null,
  monitoringInterval: (dbi: DBInstance) => dbi?.MonitoringInterval ?? null,
  monitoringRoleArn: (dbi: DBInstance) => dbi?.MonitoringRoleArn ?? null,
  multiAZ: (dbi: DBInstance) => dbi?.MultiAZ ?? null,
  ncharCharacterSetName: (dbi: DBInstance) => dbi?.NcharCharacterSetName ?? null,
  optionGroupMemberships: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.OptionGroupMemberships?.length ?
      await Promise.all(dbi.OptionGroupMemberships.map(og => OptionGroupMembershipMapper.fromAWS(og, awsClient, i)))
      : [],
  performanceInsightsKMSKeyId: (dbi: DBInstance) => dbi?.PerformanceInsightsKMSKeyId ?? null,
  performanceInsightsRetentionPeriod: (dbi: DBInstance) => dbi?.PerformanceInsightsRetentionPeriod ?? null,
  port: (dbi: DBInstance) => dbi?.DbInstancePort ?? null,
  preferredBackupWindow: (dbi: DBInstance) => dbi?.PreferredBackupWindow ?? null,
  preferredMaintenanceWindow: (dbi: DBInstance) => dbi?.PreferredMaintenanceWindow ?? null,
  processorFeatures: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.ProcessorFeatures?.length ?
      await Promise.all(dbi.ProcessorFeatures.map(pf => ProcessorFeatureMapper.fromAWS(pf, awsClient, i)))
      : [],
  promotionTier: (dbi: DBInstance) => dbi?.PromotionTier ?? null,
  publiclyAccessible: (dbi: DBInstance) => dbi?.PubliclyAccessible ?? null,
  storageEncrypted: (dbi: DBInstance) => dbi?.StorageEncrypted ?? null,
  storageType: (dbi: DBInstance) => dbi?.StorageType ?? null,
  tags: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => dbi?.TagList?.length ?
    await Promise.all(dbi.TagList.map(tag => TagMapper.fromAWS(tag, awsClient, i)))
    : [],
  tdeCredentialArn: (dbi: DBInstance) => dbi?.TdeCredentialArn ?? null,
  tdeCredentialPassword: (_dbi: DBInstance) => null,
  timezone: (dbi: DBInstance) => dbi?.Timezone ?? null,
  vpcSecurityGroups: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) =>
    dbi?.VpcSecurityGroups?.length ?
      await Promise.all(dbi.VpcSecurityGroups.map(vpcsgm => SecurityGroupMembershipMapper.fromAWS(vpcsgm, awsClient, i)))
      : [],
  dbInstanceStatus: (dbi: DBInstance) => dbi?.DBInstanceStatus ?? null,
  automaticRestartTime: (dbi: DBInstance) => dbi?.AutomaticRestartTime ?? null,
  endpoint: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => dbi?.Endpoint ? await EndpointMapper.fromAWS(dbi.Endpoint, awsClient, i) : null,
  instanceCreateTime: (dbi: DBInstance) => dbi?.InstanceCreateTime ?? null,
  dbSubnetGroup: (dbi: DBInstance) => dbi?.DBSubnetGroup?.DBSubnetGroupArn ?? null,
  latestRestorableTime: (dbi: DBInstance) => dbi?.LatestRestorableTime ?? null,
  secondaryAvailabilityZone: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => {
    if (dbi?.SecondaryAvailabilityZone) {
      const azEntity = await i.getOr(AvailabilityZone, dbi.SecondaryAvailabilityZone, awsClient.getAvailabilityZoneByName.bind(awsClient));
      return await AvailabilityZoneMapper.fromAWS(azEntity, awsClient, i);
    } else {
      return null;
    }
  },
  caCertificateIdentifier: (dbi: DBInstance) => dbi?.CACertificateIdentifier ?? null,
  dbInstanceArn: (dbi: DBInstance) => dbi?.DBInstanceArn ?? null,
  associatedRoles: (_dbi: DBInstance) => null,
  listenerEndpoint: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => dbi?.ListenerEndpoint ?
    await EndpointMapper.fromAWS(dbi.ListenerEndpoint, awsClient, i) : null,
  awsBackupRecoveryPointArn: (dbi: DBInstance) => dbi?.AwsBackupRecoveryPointArn ?? null,
  activityStreamStatus: (dbi: DBInstance) => dbi?.ActivityStreamStatus ?? null,
  activityStreamMode: async (dbi: DBInstance, awsClient: AWS, i: IndexedAWS) => dbi.ActivityStreamMode ?
    await ActivityStreamModeMapper.fromAWS(dbi.ActivityStreamMode, awsClient, i) : null,
  activityStreamKmsKeyId: (dbi: DBInstance) => dbi?.ActivityStreamKmsKeyId ?? null,
  activityStreamKinesisStreamName: (dbi: DBInstance) => dbi?.ActivityStreamKinesisStreamName ?? null,
  activityStreamEngineNativeAuditFieldsIncluded: (dbi: DBInstance) => dbi?.ActivityStreamEngineNativeAuditFieldsIncluded ?? null,
  readReplicaSourceDBInstanceIdentifier: (dbi: DBInstance) => dbi?.ReadReplicaSourceDBInstanceIdentifier ?? null,
  readReplicaDBInstanceIdentifiers: (_dbi: DBInstance) => null,
  readReplicaDBClusterIdentifiers: (_dbi: DBInstance) => null,
  replicaMode: (dbi: DBInstance) => dbi?.ReplicaMode ?? null,
  statusInfos: (_dbi: DBInstance) => null,
  dbInstanceAutomatedBackupsReplications: (_dbi: DBInstance) => null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const dbInstances = (await awsClient.getDBInstances())?.DBInstances ?? [];
    indexes.setAll(RDS, dbInstances, 'DBInstanceIdentifier');
    const t2 = Date.now();
    console.log(`RDS set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: RDS, awsClient: AWS, indexes: IndexedAWS) => {
    // First construct the rds instance
    // TODO: if inserted without sec group it assign default.
    // Should we check that here and insert it manually?
    const result = await awsClient.createDBInstance({
      // TODO: Use real obj properties
      DBInstanceClass: 'db.m5.large',
      Engine: 'postgres',
      DBInstanceIdentifier: obj.dbInstanceIdentifier,
      MasterUsername: obj.masterUsername,
      MasterUserPassword: '4l4nU$er',
      AllocatedStorage: obj.allocatedStorage,
      // TODO: complete input properties
    });
    // TODO: Handle if it fails (somehow)
    if (!result?.hasOwnProperty('DBInstanceIdentifier')) { // Failure
      throw new Error('what should we do here?');
    }
    // Re-get the inserted security group to get all of the relevant records we care about
    const newDBInstance = await awsClient.getDBInstance(result?.DBInstanceIdentifier ?? '');
    indexes.set(RDS, newDBInstance?.DBInstanceIdentifier ?? '', newDBInstance);
    // We map this into the same kind of entity as `obj`
    const newEntity: RDS = await RDSMapper.fromAWS(newDBInstance, awsClient, indexes);
    // We attach the original object's ID to this new one, indicating the exact record it is
    // replacing in the database
    newEntity.id = obj.id;
    // Then we update the DB cache object with all of these properties so we can perform multiple
    // runs without re-querying the DB
    for (const key of Object.keys(newEntity)) {
      (obj as any)[key] = (newEntity as any)[key];
    }
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    console.log('trying to update')
    // throw new Error('tbd')
  },
  deleteAWS: async (obj: RDS, awsClient: AWS, indexes: IndexedAWS) => {
    console.log('trying to delete')
    try {
      await awsClient.deleteDBInstance({
        DBInstanceIdentifier: obj.dbInstanceIdentifier,
        // TODO: do users will have access to this type of config?
        // probably initially we should play it safe and do not create a snapshot
        // and do not delete backups if any?
        SkipFinalSnapshot: true,
        // FinalDBSnapshotIdentifier: undefined,
        // DeleteAutomatedBackups: false,
      });
    } catch (e) {
      console.log(`something went wrong deleting ${e}`);
      throw new Error(`${e}`)
    }
    // TODO: What does the error even look like? Docs are spotty on this
    indexes.del(RDS, (obj as any).dbInstanceIdentifier);
    return obj;
  },
});
