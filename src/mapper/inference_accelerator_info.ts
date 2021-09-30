import { InferenceAcceleratorInfo as InferenceAcceleratorInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InferenceAcceleratorInfo, } from '../entity/inference_accelerator_info';
import { InferenceDeviceInfoMapper } from './inference_device_info';
import { AWS } from '../services/gateways/aws';

export const InferenceAcceleratorInfoMapper = new EntityMapper(InferenceAcceleratorInfo, {
  accelerators: (inferenceAcceleratorInfo: InferenceAcceleratorInfoAWS, indexes: IndexedAWS) =>
    inferenceAcceleratorInfo?.Accelerators?.length ?
      inferenceAcceleratorInfo.Accelerators.map(
        accelerator => InferenceDeviceInfoMapper.fromAWS(accelerator, indexes)
      ) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
