import { OrderableDBInstanceOption as OrderableDBInstanceOptionAWS } from '@aws-sdk/client-rds'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { OrderableDBInstanceOption, } from '../entity/orderable_db_instance_option';
import { AWS } from '../services/gateways/aws';
import { AvailabilityZoneMapper, DBInstanceClassMapper, EngineVersionMapper, ProcessorFeatureMapper, SupportedEngineModeMapper } from '.';
import { AvailabilityZone, EngineVersion } from '../entity';
import { DepError } from '../services/lazy-dep';

export const OrderableDBInstanceOptionMapper = new EntityMapper(OrderableDBInstanceOption, {
  engine: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    EngineVersionMapper.fromAWS(indexes.get(EngineVersion, opt.EngineVersion), indexes),
  dbInstanceClass: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    DBInstanceClassMapper.fromAWS(opt.DBInstanceClass, indexes),
  licenseModel: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.LicenseModel ?? null,
  availabilityZones: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    opt.AvailabilityZones?.length ?
      opt.AvailabilityZones.map(az => AvailabilityZoneMapper.fromAWS(indexes.get(AvailabilityZone, az.Name), indexes))
      : [],
  multiAZCapable: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MultiAZCapable ?? null,
  readReplicaCapable: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.ReadReplicaCapable ?? null,
  supportsStorageEncryption: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsGlobalDatabases ?? null,
  storageType: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.StorageType ?? null,
  supportsIops: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsIops ?? null,
  supportsEnhancedMonitoring: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsEnhancedMonitoring ?? null,
  supportsIAMDatabaseAuthentication: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsIAMDatabaseAuthentication ?? null,
  supportsPerformanceInsights: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsPerformanceInsights ?? null,
  minStorageSize: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MinStorageSize ?? null,
  maxStorageSize: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MaxStorageSize ?? null,
  minIopsPerDbInstance: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MinIopsPerDbInstance ?? null,
  maxIopsPerDbInstance: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MaxIopsPerDbInstance ?? null,
  minIopsPerGib: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MinIopsPerGib ?? null,
  maxIopsPerGib: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.MaxIopsPerGib ?? null,
  availableProcessorFeatures: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    opt.AvailableProcessorFeatures?.length ?
      opt.AvailableProcessorFeatures.map(pf => ProcessorFeatureMapper.fromAWS(pf, indexes))
      : [],
  supportedEngineModes: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    opt.SupportedEngineModes?.length ?
      opt.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, indexes))
      : [],
  supportsStorageAutoscaling: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsStorageAutoscaling ?? null,
  supportsKerberosAuthentication: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsKerberosAuthentication ?? null,
  outpostCapable: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.OutpostCapable ?? null,
  supportedActivityStreamModes: (opt: OrderableDBInstanceOptionAWS, indexes: IndexedAWS) =>
    opt.SupportedActivityStreamModes?.length ?
      opt.SupportedActivityStreamModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, indexes))
      : [],
  supportsGlobalDatabases: (opt: OrderableDBInstanceOptionAWS, _indexes: IndexedAWS) => opt.SupportsGlobalDatabases ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const engineVersions = indexes.get(EngineVersion);
    if (!engineVersions) throw new DepError('EnginesVersions must be loaded first');
    console.log('Got engine version')
    let engines = Object.entries(engineVersions ?? {}).map(([_, v]) => (v as OrderableDBInstanceOptionAWS).Engine!);
    engines = [...new Set(engines)];
    console.log(engines)
    let orderable_db_instance_options = [];
    try {
      orderable_db_instance_options = (await awsClient.getOrderableInstanceOptions(engines))?.OrderableDBInstanceOptions ?? [];
    } catch (e) {
      console.log(`${e}`);
      throw e;
    }
    indexes.setAllWithComposeKey(OrderableDBInstanceOption, orderable_db_instance_options, ['Engine', 'EngineVersion', 'DBInstanceClass', 'StorageType']);
    const t2 = Date.now();
    console.log(`OrderableBDInstanceOptions set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
