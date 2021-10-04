import { VCpuInfo } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { VCPUInfo } from '../entity/v_cpu_info';
import { ValidCoreMapper } from './valid_core';
import { ValidThreadsPerCoreMapper } from './valid_threads_per_core';
import { AWS } from '../services/gateways/aws';

export const VCPUInfoMapper = new EntityMapper(VCPUInfo, {
  defaultVCPUs: (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultVCpus ?? null,
  defaultCores: (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultCores ?? null,
  defaultThreadsPerCore: (vCPUInfo: VCpuInfo, _indexes: IndexedAWS) => vCPUInfo?.DefaultThreadsPerCore ?? null,
  validCores: (vCPUInfo: VCpuInfo, indexes: IndexedAWS) =>
    vCPUInfo?.ValidCores?.length ?
      vCPUInfo.ValidCores.map(
        count => ValidCoreMapper.fromAWS(count, indexes)
      ) :
      [],
  validThreadsPerCore: (vCPUInfo: VCpuInfo, indexes: IndexedAWS) =>
    vCPUInfo?.ValidThreadsPerCore?.length ?
      vCPUInfo.ValidThreadsPerCore.map(
        count => ValidThreadsPerCoreMapper.fromAWS(count, indexes)
      ) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
