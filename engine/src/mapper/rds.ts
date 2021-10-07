import { DBInstance } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { AvailabilityZone, SecurityGroup, SecurityGroupRule, } from '../entity'
import { RDS } from '../entity/rds'
import { AvailabilityZoneMapper, SecurityGroupMapper, TagMapper } from '.'

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
  domainMemberships: (dbi: DBInstance, _i: IndexedAWS) => null,
  enableCloudwatchLogsExports: (dbi: DBInstance, _i: IndexedAWS) => dbi?.EnabledCloudwatchLogsExports?.pop() ?? null,
  enableCustomerOwnedIp: (dbi: DBInstance, _i: IndexedAWS) => dbi?.CustomerOwnedIpEnabled ?? null,
  enableIAMDatabaseAuthentication: (dbi: DBInstance, _i: IndexedAWS) => dbi?.IAMDatabaseAuthenticationEnabled ?? null,
  enablePerformanceInsights: (dbi: DBInstance, _i: IndexedAWS) => dbi?.PerformanceInsightsEnabled ?? null,
  engine: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Engine,
  engineVersion: (dbi: DBInstance, _i: IndexedAWS) => dbi?.EngineVersion ?? null,
  iops: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Iops ?? null,
  kmsKeyId: (dbi: DBInstance, _i: IndexedAWS) => dbi?.KmsKeyId ?? null,
  licenseModel: (dbi: DBInstance, _i: IndexedAWS) => dbi?.LicenseModel ?? null,
  masterUsername: (dbi: DBInstance, _i: IndexedAWS) => dbi?.MasterUsername ?? null,
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
  tags: (dbi: DBInstance, i: IndexedAWS) => dbi?.TagList?.length ?
    dbi.TagList.map(tag => TagMapper.fromAWS(tag, i)) :
    [],
  tdeCredentialArn: (dbi: DBInstance, _i: IndexedAWS) => dbi?.TdeCredentialArn ?? null,
  timezone: (dbi: DBInstance, _i: IndexedAWS) => dbi?.Timezone ?? null,
  vpcSecurityGroups: (dbi: DBInstance, i: IndexedAWS) => dbi?.VpcSecurityGroups?.length ?
    dbi.VpcSecurityGroups.map(vpcsg => SecurityGroupMapper.fromAWS(vpcsg, i)) :
    [],
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const dbInstances = (await awsClient.getDBInstances())?.DBInstances ?? [];
    indexes.setAll(RDS, dbInstances, 'DbiResourceId');
    const t2 = Date.now();
    console.log(`RDS set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: SecurityGroup, awsClient: AWS, indexes: IndexedAWS) => {
    throw new Error('tbd')
    // // First construct the security group
    // const result = await awsClient.createSecurityGroup({
    //   Description: obj.description,
    //   GroupName: obj.groupName,
    //   VpcId: obj.vpcId,
    //   // TODO: Tags
    // });
    // // TODO: Handle if it fails (somehow)
    // if (!result.hasOwnProperty('GroupId')) { // Failure
    //   throw new Error('what should we do here?');
    // }
    // // TODO: Determine if the following logic really belongs here or not
    // // Re-get the inserted security group to get all of the relevant records we care about
    // const newGroup = await awsClient.getSecurityGroup(result.GroupId ?? '');
    // // We map this into the same kind of entity as `obj`
    // const newEntity: SecurityGroup = SecurityGroupMapper.fromAWS(newGroup, indexes);
    // indexes.set(SecurityGroup, (newEntity as any).groupId, newEntity);
    // // We attach the original object's ID to this new one, indicating the exact record it is
    // // replacing in the database
    // newEntity.id = obj.id;
    // // It's up to the caller if they want to actually update into the DB or not, though.
    // return newEntity;
  },
  updateAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // // TODO: To do updates right on this, since AWS doesn't actually support updating the outer
    // // records of a security group, we have to delete and recreate, but since other relations will
    // // still exist in the database for an update but would not on an actual delete, we will have to
    // // temporarily remove any association of the security group from anything that can join on it,
    // // which is an unfortunate violation of separation of concerns. At least EC2 instances are a
    // // problem, but also likely the weird references to VPNs and likely other services, in AWS, too.
    // // For now, though, we'll just ignore and fill this in once it bites us.
    // await SecurityGroupMapper.deleteAWS(obj, awsClient, indexes);
    // return await SecurityGroupMapper.createAWS(obj, awsClient, indexes);
    throw new Error('tbd')
  },
  deleteAWS: async (obj: SecurityGroup, awsClient: AWS, indexes: IndexedAWS) => {
    // await awsClient.deleteSecurityGroup({
    //   GroupId: obj.groupId,
    // });
    // // TODO: What does the error even look like? Docs are spotty on this
    // indexes.del(SecurityGroup, (obj as any).groupId);
    // return obj;
    throw new Error('tbd')
  },
});
