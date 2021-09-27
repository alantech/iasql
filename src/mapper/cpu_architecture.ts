
import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { CPUArchitecture, } from '../entity/cpu_architecture';

export const CPUArchitectureMapper = new EntityMapper(CPUArchitecture, {
  cpuArchitecture: async (cpuArchitecure: string, _indexes: IndexedAWS) => cpuArchitecure,
})
