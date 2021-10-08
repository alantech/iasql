import { DBInstance } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { RDS } from '../entity/rds'
import { AvailabilityZoneMapper, EngineVersionMapper, SecurityGroupMapper, TagMapper } from '.'
import { AvailabilityZone, EngineVersion } from '../entity'

export const RDSMapper: EntityMapper = new EntityMapper(RDS, {
  dbiResourceId: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DbiResourceId ?? null,
  dbInstanceIdentifier: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBInstanceIdentifier,
  allocatedStorage: (dbi: DBInstance, _i: IndexedAWS) => dbi?.AllocatedStorage,
  autoMinorVersionUpgrade: (dbi: DBInstance, _i: IndexedAWS) => dbi?.AutoMinorVersionUpgrade ?? null,
  availabilityZone: (dbi: DBInstance, i: IndexedAWS) =>
    dbi?.AvailabilityZone ?
      AvailabilityZoneMapper.fromAWS(i.get(AvailabilityZone, dbi.AvailabilityZone), i)
      : null,
  backupRetentionPeriod: (dbi: DBInstance, _i: IndexedAWS) => dbi?.BackupRetentionPeriod ?? null,
  characterSetName: (dbi: DBInstance, _i: IndexedAWS) => dbi?.CharacterSetName ?? null,
  copyTagsToSnapshot: (dbi: DBInstance, _i: IndexedAWS) => dbi?.CopyTagsToSnapshot ?? null,
  dbClusterIdentifier: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBClusterIdentifier ?? null,
  dbInstanceClass: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBInstanceClass,
  dbName: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBName ?? null,
  dbParameterGroups: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBParameterGroups?.pop()?.DBParameterGroupName ?? null,
  dbSecurityGroups: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBSecurityGroups?.pop()?.DBSecurityGroupName ?? null,
  deletionProtection: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DeletionProtection ?? null,
  domainMemberships: (_dbi: DBInstance, _i: IndexedAWS) => null,
  enableCloudwatchLogsExports: (dbi: DBInstance, _i: IndexedAWS) => dbi?.EnabledCloudwatchLogsExports?.pop() ?? null,
  enableCustomerOwnedIp: (dbi: DBInstance, _i: IndexedAWS) => dbi?.CustomerOwnedIpEnabled ?? null,
  enableIAMDatabaseAuthentication: (dbi: DBInstance, _i: IndexedAWS) => dbi?.IAMDatabaseAuthenticationEnabled ?? null,
  enablePerformanceInsights: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PerformanceInsightsEnabled ?? null,
  engine: (dbi: DBInstance, i: IndexedAWS) => EngineVersionMapper.fromAWS(i.get(EngineVersion, dbi.EngineVersion), i),
  iops: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Iops ?? null,
  kmsKeyId: (dbi: DBInstance, _i: IndexedAWS) => dbi?.KmsKeyId ?? null,
  licenseModel: (dbi: DBInstance, _i: IndexedAWS) => dbi?.LicenseModel ?? null,
  masterUsername: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MasterUsername ?? null,
  masterUserPassword: (_dbi: DBInstance, _i: IndexedAWS) => null,
  maxAllocatedStorage: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MaxAllocatedStorage ?? null,
  monitoringInterval: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MonitoringInterval ?? null,
  monitoringRoleArn: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MonitoringRoleArn ?? null,
  multiAZ: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MultiAZ ?? null,
  ncharCharacterSetName: (dbi: DBInstance, _i: IndexedAWS) => dbi?.NcharCharacterSetName ?? null,
  optionGroupName: (dbi: DBInstance, _i: IndexedAWS) => dbi?.OptionGroupMemberships?.pop()?.OptionGroupName ?? null,
  performanceInsightsKMSKeyId: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PerformanceInsightsKMSKeyId ?? null,
  performanceInsightsRetentionPeriod: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PerformanceInsightsRetentionPeriod ?? null,
  port: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DbInstancePort ?? null,
  preferredBackupWindow: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PreferredBackupWindow ?? null,
  preferredMaintenanceWindow: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PreferredMaintenanceWindow ?? null,
  processorFeatures: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ProcessorFeatures?.pop()?.Name ?? null,
  promotionTier: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PromotionTier ?? null,
  publiclyAccessible: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PubliclyAccessible ?? null,
  storageEncrypted: (dbi: DBInstance, _i: IndexedAWS) => dbi?.StorageEncrypted ?? null,
  storageType: (dbi: DBInstance, _i: IndexedAWS) => dbi?.StorageType ?? null,
  tags: (dbi: DBInstance, i: IndexedAWS) => dbi?.TagList?.length ?
    dbi.TagList.map(tag => TagMapper.fromAWS(tag, i)) :
    [],
  tdeCredentialArn: (dbi: DBInstance, _i: IndexedAWS) => dbi?.TdeCredentialArn ?? null,
  tdeCredentialPassword: (_dbi: DBInstance, _i: IndexedAWS) => null,
  timezone: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Timezone ?? null,
  vpcSecurityGroups: (dbi: DBInstance, i: IndexedAWS) =>
    dbi?.VpcSecurityGroups?.length ?
      dbi.VpcSecurityGroups.map(vpcsg => SecurityGroupMapper.fromAWS(vpcsg, i)) :
      [],
  dbInstanceStatus: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBInstanceStatus ?? null,
  automaticRestartTime: (dbi: DBInstance, _i: IndexedAWS) => dbi?.AutomaticRestartTime ?? null,
  endpoint: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Endpoint?.Address ?? null,
  instanceCreateTime: (dbi: DBInstance, _i: IndexedAWS) => dbi?.InstanceCreateTime ?? null,
  dbSubnetGroup: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBSubnetGroup?.DBSubnetGroupArn ?? null,
  latestRestorableTime: (dbi: DBInstance, _i: IndexedAWS) => dbi?.LatestRestorableTime ?? null,
  secondaryAvailabilityZone: (dbi: DBInstance, i: IndexedAWS) =>
    dbi?.SecondaryAvailabilityZone ?
      AvailabilityZoneMapper.fromAWS(i.get(AvailabilityZone, dbi.SecondaryAvailabilityZone), i)
      : null,
  caCertificateIdentifier: (dbi: DBInstance, _i: IndexedAWS) => dbi?.CACertificateIdentifier ?? null,
  dbInstanceArn: (dbi: DBInstance, _i: IndexedAWS) => dbi?.DBInstanceArn ?? null,
  associatedRoles: (_dbi: DBInstance, _i: IndexedAWS) => null,
  listenerEndpoint: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ListenerEndpoint?.Address ?? null,
  awsBackupRecoveryPointArn: (dbi: DBInstance, _i: IndexedAWS) => dbi?.AwsBackupRecoveryPointArn ?? null,
  activityStreamStatus: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ActivityStreamStatus ?? null,
  activityStreamMode: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ActivityStreamMode ?? null,
  activityStreamKmsKeyId: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ActivityStreamKmsKeyId ?? null,
  activityStreamKinesisStreamName: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ActivityStreamKinesisStreamName ?? null,
  activityStreamEngineNativeAuditFieldsIncluded: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ActivityStreamEngineNativeAuditFieldsIncluded ?? null,
  readReplicaSourceDBInstanceIdentifier: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ReadReplicaSourceDBInstanceIdentifier ?? null,
  readReplicaDBInstanceIdentifiers: (_dbi: DBInstance, _i: IndexedAWS) => null,
  readReplicaDBClusterIdentifiers: (_dbi: DBInstance, _i: IndexedAWS) => null,
  replicaMode: (dbi: DBInstance, _i: IndexedAWS) => dbi?.ReplicaMode ?? null,
  statusInfos: (_dbi: DBInstance, _i: IndexedAWS) => null,
  dbInstanceAutomatedBackupsReplications: (_dbi: DBInstance, _i: IndexedAWS) => null,

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
    if (!result.hasOwnProperty('DBInstanceIdentifier')) { // Failure
      throw new Error('what should we do here?');
    }
    // Re-get the inserted security group to get all of the relevant records we care about
    const newDBInstance = await awsClient.getDBInstance(result.DBInstance?.DBInstanceIdentifier ?? '');
    indexes.set(RDS, newDBInstance?.DBInstanceIdentifier ?? '', newDBInstance);
    // We map this into the same kind of entity as `obj`
    const newEntity: RDS = RDSMapper.fromAWS(newDBInstance, indexes);
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
