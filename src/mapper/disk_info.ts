import { DiskInfo as DiskInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { DiskInfo, } from '../entity/disk_info';
import { AWS } from '../services/gateways/aws';

export const DiskInfoMapper = new EntityMapper(DiskInfo, {
  sizeInGB: (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.SizeInGB ?? null,
  count: (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.Count ?? null,
  type: (diskInfo: DiskInfoAWS, _indexes: IndexedAWS) => diskInfo?.Type ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
