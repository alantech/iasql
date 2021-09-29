import { GpuDeviceInfo as GpuDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUDeviceInfo, } from '../entity/gpu_device_info';
import { GPUDeviceMemoryInfoMapper } from './gpu_device_memory_info';

export const GPUDeviceInfoMapper = new EntityMapper(GPUDeviceInfo, {
  name: async (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Name,
  manufacturer: async (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Manufacturer,
  count: async (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Count,
  memoryInfo: async (gpuDeviceInfo: GpuDeviceInfoAWS, indexes: IndexedAWS) =>
    gpuDeviceInfo?.MemoryInfo ? GPUDeviceMemoryInfoMapper.fromAWS(
      gpuDeviceInfo?.MemoryInfo, indexes
    ) : undefined,
})
