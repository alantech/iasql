import { DiskInfo as DiskInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { DiskInfo, } from '../entity/disk_info';

export const DiskInfoMapper = new EntityMapper(DiskInfo, {
  sizeInGB: async (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.SizeInGB,
  count: async (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.Count,
  type: async (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.Type,
})
