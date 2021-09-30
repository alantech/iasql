import { RootDeviceType } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { DeviceType } from '../entity/device_type';
import { AWS } from '../services/gateways/aws';

export const DeviceTypeMapper = new EntityMapper(DeviceType, {
  deviceType: (deviceType: RootDeviceType, _indexes: IndexedAWS) => deviceType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
