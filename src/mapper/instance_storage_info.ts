import { InstanceStorageInfo as InstanceStorageInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InstanceStorageInfo, } from '../entity/instance_storage_info';
import { DiskInfoMapper } from './disk_info';
import { AWS } from '../services/gateways/aws';

export const InstanceStorageInfoMapper = new EntityMapper(InstanceStorageInfo, {
  totalSizeInGB: (instanceStorageInfo: InstanceStorageInfoAWS, _indexes: IndexedAWS) => instanceStorageInfo?.TotalSizeInGB,
  disks: (instanceStorageInfo: InstanceStorageInfoAWS, indexes: IndexedAWS) =>
    instanceStorageInfo?.Disks?.length ?
      instanceStorageInfo.Disks.map(
        disk => DiskInfoMapper.fromAWS(disk, indexes)
      ) :
      [],
  NVMESupport: (instanceStorageInfo: InstanceStorageInfoAWS, _indexes: IndexedAWS) => instanceStorageInfo?.NvmeSupport,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
