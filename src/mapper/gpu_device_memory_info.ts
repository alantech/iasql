import { GpuDeviceMemoryInfo as GpuDeviceMemoryInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUDeviceMemoryInfo, } from '../entity/gpu_device_memory_info';
import { AWS } from '../services/gateways/aws';

export const GPUDeviceMemoryInfoMapper = new EntityMapper(GPUDeviceMemoryInfo, {
  sizeInMiB: (gpuDeviceMemoryInfo: GpuDeviceMemoryInfoAWS, _indexes: IndexedAWS) => gpuDeviceMemoryInfo?.SizeInMiB ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
