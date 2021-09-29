
import { InstanceStorageInfo as InstanceStorageInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InstanceStorageInfo, } from '../entity/instance_storage_info';
import { DiskInfoMapper } from './disk_info';

export const InstanceStorageInfoMapper = new EntityMapper(InstanceStorageInfo, {
  totalSizeInGB: async (instanceStorageInfo: InstanceStorageInfoAWS, _indexes: IndexedAWS) => instanceStorageInfo?.TotalSizeInGB,
  disks: async (instanceStorageInfo: InstanceStorageInfoAWS, indexes: IndexedAWS) =>
    instanceStorageInfo?.Disks && instanceStorageInfo?.Disks.length ?
      await Promise.all(instanceStorageInfo.Disks.map(
        disk => DiskInfoMapper.fromAWS(disk, indexes)
      )) :
      [],
  NVMESupport: async (instanceStorageInfo: InstanceStorageInfoAWS, _indexes: IndexedAWS) => instanceStorageInfo?.NvmeSupport,
})
