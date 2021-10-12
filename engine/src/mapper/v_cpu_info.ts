import { VCpuInfo } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { VCPUInfo, } from '../entity/v_cpu_info'
import { ValidCoreMapper, } from './valid_core'
import { ValidThreadsPerCoreMapper, } from './valid_threads_per_core'

export const VCPUInfoMapper = new EntityMapper(VCPUInfo, {
  defaultVCPUs: (vCPUInfo: VCpuInfo) => vCPUInfo?.DefaultVCpus ?? null,
  defaultCores: (vCPUInfo: VCpuInfo) => vCPUInfo?.DefaultCores ?? null,
  defaultThreadsPerCore: (vCPUInfo: VCpuInfo) => vCPUInfo?.DefaultThreadsPerCore ?? null,
  validCores: async (vCPUInfo: VCpuInfo, awsClient: AWS, indexes: IndexedAWS) =>
    vCPUInfo?.ValidCores?.length ?
      await Promise.all(vCPUInfo.ValidCores.map(
        count => ValidCoreMapper.fromAWS(count, awsClient, indexes)
      )) :
      [],
  validThreadsPerCore: async (vCPUInfo: VCpuInfo, awsClient: AWS, indexes: IndexedAWS) =>
    vCPUInfo?.ValidThreadsPerCore?.length ?
      await Promise.all(vCPUInfo.ValidThreadsPerCore.map(
        count => ValidThreadsPerCoreMapper.fromAWS(count, awsClient, indexes)
      )) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
