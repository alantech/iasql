import { GpuInfo as GpuInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { GPUDeviceInfoMapper, } from './gpu_device_info'
import { GPUInfo, } from '../entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const GPUInfoMapper = new EntityMapper(GPUInfo, {
  totalGPUMemoryInMiB: (gpuInfo: GpuInfoAWS) => gpuInfo?.TotalGpuMemoryInMiB ?? null,
  gpus: async (gpuInfo: GpuInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    gpuInfo?.Gpus?.length ?
      await Promise.all(gpuInfo.Gpus.map(
        gpu => GPUDeviceInfoMapper.fromAWS(gpu, awsClient, indexes)
      )) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
