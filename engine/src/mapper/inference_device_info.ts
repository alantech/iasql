import { InferenceDeviceInfo as InferenceDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InferenceDeviceInfo, } from '../entity/inference_device_info';
import { AWS } from '../services/gateways/aws';

export const InferenceDeviceInfoMapper = new EntityMapper(InferenceDeviceInfo, {
  name: (inferenceDeviceInfo: InferenceDeviceInfoAWS, _indexes: IndexedAWS) => inferenceDeviceInfo?.Name ?? null,
  count: (inferenceDeviceInfo: InferenceDeviceInfoAWS, _indexes: IndexedAWS) => inferenceDeviceInfo?.Count ?? null,
  manufacturer: (inferenceDeviceInfo: InferenceDeviceInfoAWS, _indexes: IndexedAWS) => inferenceDeviceInfo?.Manufacturer ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
