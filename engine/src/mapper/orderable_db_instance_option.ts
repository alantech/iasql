import { OrderableDBInstanceOption as OrderableDBInstanceOptionAWS, } from '@aws-sdk/client-rds'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity'
import { OrderableDBInstanceOption, } from '../entity/orderable_db_instance_option'
import { AWS, } from '../services/gateways/aws'
import {
  AvailabilityZoneMapper,
  DBInstanceClassMapper,
  EngineVersionMapper,
  ProcessorFeatureMapper,
  SupportedEngineModeMapper,
} from '.'
import { AvailabilityZone, EngineVersion, } from '../entity'
import { DepError, } from '../services/lazy-dep'

export const OrderableDBInstanceOptionMapper = new EntityMapper(OrderableDBInstanceOption, {
  engine: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    const engineVersionEntity = await indexes.getOr(EngineVersion, opt.EngineVersion!, awsClient.getEngineVersion.bind(awsClient));
    return await EngineVersionMapper.fromAWS(engineVersionEntity, awsClient, indexes);
  },
  dbInstanceClass: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    await DBInstanceClassMapper.fromAWS(opt.DBInstanceClass, awsClient, indexes),
  licenseModel: (opt: OrderableDBInstanceOptionAWS) => opt.LicenseModel ?? null,
  availabilityZones: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    opt.AvailabilityZones?.length ?
      await Promise.all(opt?.AvailabilityZones?.map(async (az) => {
        const azEntity = await indexes.getOr(AvailabilityZone, az.Name ?? '', awsClient.getAvailabilityZoneByName.bind(awsClient));
        return AvailabilityZoneMapper.fromAWS(azEntity, awsClient, indexes);
      })) : [],
  multiAZCapable: (opt: OrderableDBInstanceOptionAWS) => opt.MultiAZCapable ?? null,
  readReplicaCapable: (opt: OrderableDBInstanceOptionAWS) => opt.ReadReplicaCapable ?? null,
  supportsStorageEncryption: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsGlobalDatabases ?? null,
  storageType: (opt: OrderableDBInstanceOptionAWS) => opt.StorageType ?? null,
  supportsIops: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsIops ?? null,
  supportsEnhancedMonitoring: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsEnhancedMonitoring ?? null,
  supportsIAMDatabaseAuthentication: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsIAMDatabaseAuthentication ?? null,
  supportsPerformanceInsights: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsPerformanceInsights ?? null,
  minStorageSize: (opt: OrderableDBInstanceOptionAWS) => opt.MinStorageSize ?? null,
  maxStorageSize: (opt: OrderableDBInstanceOptionAWS) => opt.MaxStorageSize ?? null,
  minIopsPerDbInstance: (opt: OrderableDBInstanceOptionAWS) => opt.MinIopsPerDbInstance ?? null,
  maxIopsPerDbInstance: (opt: OrderableDBInstanceOptionAWS) => opt.MaxIopsPerDbInstance ?? null,
  minIopsPerGib: (opt: OrderableDBInstanceOptionAWS) => opt.MinIopsPerGib ?? null,
  maxIopsPerGib: (opt: OrderableDBInstanceOptionAWS) => opt.MaxIopsPerGib ?? null,
  availableProcessorFeatures: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    opt.AvailableProcessorFeatures?.length ?
      await Promise.all(opt.AvailableProcessorFeatures.map(pf => ProcessorFeatureMapper.fromAWS(pf, awsClient, indexes)))
      : [],
  supportedEngineModes: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    opt.SupportedEngineModes?.length ?
      await Promise.all(opt.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, awsClient, indexes)))
      : [],
  supportsStorageAutoscaling: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsStorageAutoscaling ?? null,
  supportsKerberosAuthentication: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsKerberosAuthentication ?? null,
  outpostCapable: (opt: OrderableDBInstanceOptionAWS) => opt.OutpostCapable ?? null,
  supportedActivityStreamModes: async (opt: OrderableDBInstanceOptionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    opt.SupportedActivityStreamModes?.length ?
      await Promise.all(opt.SupportedActivityStreamModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, awsClient, indexes)))
      : [],
  supportsGlobalDatabases: (opt: OrderableDBInstanceOptionAWS) => opt.SupportsGlobalDatabases ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const engineVersions = indexes.get(EngineVersion);
    if (!engineVersions) throw new DepError('EnginesVersions must be loaded first');
    let engines = Object.entries(engineVersions ?? {}).map(([_, v]) => (v as OrderableDBInstanceOptionAWS).Engine!);
    engines = [...new Set(engines)];
    let orderableDBInstanceOptions = [];
    // TODO: remove engine filter
    orderableDBInstanceOptions = (await awsClient.getOrderableInstanceOptions(['postgres']/*engines*/))?.OrderableDBInstanceOptions ?? [];
    indexes.setAllWithComposeKey(OrderableDBInstanceOption, orderableDBInstanceOptions, ['Engine', 'EngineVersion', 'DBInstanceClass', 'StorageType']);
    const t2 = Date.now();
    console.log(`OrderableBDInstanceOptions set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
