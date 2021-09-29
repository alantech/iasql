import { VCpuInfo } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { VCPUInfo } from '../entity/v_cpu_info';
import { ValidCoreMapper } from './valid_core';
import { ValidThreadsPerCoreMapper } from './valid_threads_per_core';

export const VCPUInfoMapper = new EntityMapper(VCPUInfo, {
  defaultVCPUs: async (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultVCpus,
  defaultCores: async (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultCores,
  defaultThreadsPerCore: async (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultThreadsPerCore,
  validCores: async (vCPUInfo: VCpuInfo, indexes: IndexedAWS) =>
    vCPUInfo?.ValidCores && vCPUInfo?.ValidCores.length ?
      await Promise.all(vCPUInfo.ValidCores.map(
        count => ValidCoreMapper.fromAWS(count, indexes)
      )) :
      [],
  validThreadsPerCore: async (vCPUInfo: VCpuInfo, indexes: IndexedAWS) =>
    vCPUInfo?.ValidThreadsPerCore && vCPUInfo?.ValidThreadsPerCore.length ?
      await Promise.all(vCPUInfo.ValidThreadsPerCore.map(
        count => ValidThreadsPerCoreMapper.fromAWS(count, indexes)
      )) :
      [],
})
