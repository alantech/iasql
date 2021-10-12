import { DiskInfo as DiskInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { DiskInfo, } from '../entity/disk_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const DiskInfoMapper = new EntityMapper(DiskInfo, {
  sizeInGB: (diskInfo: DiskInfoAWS) => diskInfo?.SizeInGB ?? null,
  count: (diskInfo: DiskInfoAWS) => diskInfo?.Count ?? null,
  type: (diskInfo: DiskInfoAWS) => diskInfo?.Type ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
