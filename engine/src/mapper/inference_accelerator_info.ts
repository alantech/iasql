import { InferenceAcceleratorInfo as InferenceAcceleratorInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { InferenceAcceleratorInfo, } from '../entity/inference_accelerator_info'
import { InferenceDeviceInfoMapper, } from './inference_device_info'

export const InferenceAcceleratorInfoMapper = new EntityMapper(InferenceAcceleratorInfo, {
  accelerators: async (inferenceAcceleratorInfo: InferenceAcceleratorInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    inferenceAcceleratorInfo?.Accelerators?.length ?
      await Promise.all(inferenceAcceleratorInfo.Accelerators.map(
        accelerator => InferenceDeviceInfoMapper.fromAWS(accelerator, awsClient, indexes)
      )) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
