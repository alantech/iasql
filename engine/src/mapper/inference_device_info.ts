import { InferenceDeviceInfo as InferenceDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { InferenceDeviceInfo, } from '../entity/inference_device_info'

export const InferenceDeviceInfoMapper = new EntityMapper(InferenceDeviceInfo, {
  name: (inferenceDeviceInfo: InferenceDeviceInfoAWS) => inferenceDeviceInfo?.Name ?? null,
  count: (inferenceDeviceInfo: InferenceDeviceInfoAWS) => inferenceDeviceInfo?.Count ?? null,
  manufacturer: (inferenceDeviceInfo: InferenceDeviceInfoAWS) => inferenceDeviceInfo?.Manufacturer ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
