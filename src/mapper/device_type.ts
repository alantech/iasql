import { RootDeviceType } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { DeviceType } from '../entity/device_type';

export const DeviceTypeMapper = new EntityMapper(DeviceType, {
  deviceType: async (deviceType: RootDeviceType, _indexes: IndexedAWS) => deviceType,
})
