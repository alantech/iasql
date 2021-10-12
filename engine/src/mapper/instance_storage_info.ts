import { InstanceStorageInfo as InstanceStorageInfoAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { DiskInfoMapper, } from './disk_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { InstanceStorageInfo, } from '../entity/instance_storage_info'

export const InstanceStorageInfoMapper = new EntityMapper(InstanceStorageInfo, {
  totalSizeInGB: (instanceStorageInfo: InstanceStorageInfoAWS) => instanceStorageInfo?.TotalSizeInGB ?? null,
  disks: async (instanceStorageInfo: InstanceStorageInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    instanceStorageInfo?.Disks?.length ?
      await Promise.all(instanceStorageInfo.Disks.map(
        disk => DiskInfoMapper.fromAWS(disk, awsClient, indexes)
      )) :
      [],
  NVMESupport: (instanceStorageInfo: InstanceStorageInfoAWS) => instanceStorageInfo?.NvmeSupport ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
