import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { VCPUInfo } from '../entity/v_cpu_info';
import { ValidCoreMapper } from './valid_core';
import { ValidThreadsPerCoreMapper } from './valid_threads_per_core';

export const VCPUInfoMapper = new EntityMapper(VCPUInfo, {
  defaultVCPUs: async (defaultVCPUs: number, _indexes: IndexedAWS) => defaultVCPUs,
  defaultCores: async (defaultCores: number, _indexes: IndexedAWS) => defaultCores,
  defaultThreadsPerCore: async (defaultThreadsPerCore: number, _indexes: IndexedAWS) => defaultThreadsPerCore,
  validCores: async (validCores: number[], indexes: IndexedAWS) =>
    validCores && validCores.length ?
      await Promise.all(validCores.map(
        count => ValidCoreMapper.fromAWS(count, indexes)
      )) :
      [],
  validThreadsPerCore: async (validThreadsPerCore: number[], indexes: IndexedAWS) =>
    validThreadsPerCore && validThreadsPerCore.length ?
      await Promise.all(validThreadsPerCore.map(
        count => ValidThreadsPerCoreMapper.fromAWS(count, indexes)
      )) :
      [],
})
