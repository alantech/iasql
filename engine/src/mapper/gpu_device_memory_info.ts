import { GpuDeviceMemoryInfo as GpuDeviceMemoryInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { GPUDeviceMemoryInfo, } from '../entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const GPUDeviceMemoryInfoMapper = new EntityMapper(GPUDeviceMemoryInfo, {
  sizeInMiB: (gpuDeviceMemoryInfo: GpuDeviceMemoryInfoAWS) => gpuDeviceMemoryInfo?.SizeInMiB ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
