import { GpuInfo as GpuInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUInfo, } from '../entity/gpu_info';
import { GPUDeviceInfoMapper } from './gpu_device_info';
import { AWS } from '../services/gateways/aws';

export const GPUInfoMapper = new EntityMapper(GPUInfo, {
  totalGPUMemoryInMiB: (gpuInfo: GpuInfoAWS, _indexes: IndexedAWS) => gpuInfo?.TotalGpuMemoryInMiB,
  gpus: (gpuInfo: GpuInfoAWS, indexes: IndexedAWS) =>
    gpuInfo?.Gpus && gpuInfo?.Gpus.length ?
      gpuInfo.Gpus.map(
        gpu => GPUDeviceInfoMapper.fromAWS(gpu, indexes)
      ) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
