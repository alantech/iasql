import { AWS, } from '../services/gateways/aws'
import { CPUArchitecture, } from '../entity/cpu_architecture';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const CPUArchitectureMapper = new EntityMapper(CPUArchitecture, {
  cpuArchitecture: (cpuArchitecure: string, _indexes: IndexedAWS) => cpuArchitecure,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
