import { GpuDeviceMemoryInfo as GpuDeviceMemoryInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUDeviceMemoryInfo, } from '../entity/gpu_device_memory_info';

export const GPUDeviceMemoryInfoMapper = new EntityMapper(GPUDeviceMemoryInfo, {
  sizeInMiB: async (gpuDeviceMemoryInfo: GpuDeviceMemoryInfoAWS, _indexes: IndexedAWS) => gpuDeviceMemoryInfo?.SizeInMiB,
})
