import { RootDeviceType } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { DeviceType, } from '../entity/device_type'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const DeviceTypeMapper = new EntityMapper(DeviceType, {
  deviceType: (deviceType: RootDeviceType) => deviceType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
