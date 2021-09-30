import { GpuDeviceInfo as GpuDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUDeviceInfo, } from '../entity/gpu_device_info';
import { GPUDeviceMemoryInfoMapper } from './gpu_device_memory_info';
import { AWS } from '../services/gateways/aws';

export const GPUDeviceInfoMapper = new EntityMapper(GPUDeviceInfo, {
  name: (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Name,
  manufacturer: (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Manufacturer,
  count: (gpuDeviceInfo: GpuDeviceInfoAWS, _indexes: IndexedAWS) => gpuDeviceInfo?.Count,
  memoryInfo: (gpuDeviceInfo: GpuDeviceInfoAWS, indexes: IndexedAWS) =>
    gpuDeviceInfo?.MemoryInfo ? GPUDeviceMemoryInfoMapper.fromAWS(
      gpuDeviceInfo?.MemoryInfo, indexes
    ) : null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
