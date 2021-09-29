import { GpuInfo as GpuInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { GPUInfo, } from '../entity/gpu_info';
import { GPUDeviceInfoMapper } from './gpu_device_info';

export const GPUInfoMapper = new EntityMapper(GPUInfo, {
  totalGPUMemoryInMiB: async (gpuInfo: GpuInfoAWS, _indexes: IndexedAWS) => gpuInfo?.TotalGpuMemoryInMiB,
  gpus: async (gpuInfo: GpuInfoAWS, indexes: IndexedAWS) =>
    gpuInfo?.Gpus && gpuInfo?.Gpus.length ?
      await Promise.all(gpuInfo.Gpus.map(
        gpu => GPUDeviceInfoMapper.fromAWS(gpu, indexes)
      )) :
      [],
})
