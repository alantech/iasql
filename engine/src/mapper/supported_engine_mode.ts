import { AWS, } from '../services/gateways/aws'
import { SupportedEngineMode, } from '../entity/supported_engine_mode';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const SupportedEngineModeMapper = new EntityMapper(SupportedEngineMode, {
  mode: (mode: string, _indexes: IndexedAWS) => mode,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
