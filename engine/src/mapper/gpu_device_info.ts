import { GpuDeviceInfo as GpuDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { GPUDeviceInfo, } from '../entity'
import { GPUDeviceMemoryInfoMapper, } from './gpu_device_memory_info'
import { IndexedAWS, } from '../services/indexed-aws'

export const GPUDeviceInfoMapper = new EntityMapper(GPUDeviceInfo, {
  name: (gpuDeviceInfo: GpuDeviceInfoAWS) => gpuDeviceInfo?.Name ?? null,
  manufacturer: (gpuDeviceInfo: GpuDeviceInfoAWS) => gpuDeviceInfo?.Manufacturer ?? null,
  count: (gpuDeviceInfo: GpuDeviceInfoAWS) => gpuDeviceInfo?.Count ?? null,
  memoryInfo: async (gpuDeviceInfo: GpuDeviceInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    gpuDeviceInfo?.MemoryInfo ? await GPUDeviceMemoryInfoMapper.fromAWS(
      gpuDeviceInfo?.MemoryInfo, awsClient, indexes
    ) : null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
