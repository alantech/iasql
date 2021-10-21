import { AWS, } from '../services/gateways/aws'
import { Compatibility, } from '../entity/compatibility'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const CompatibilityMapper = new EntityMapper(Compatibility, {
  name: (name: string) => name,
},
  {
    readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
    createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
    updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
    deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  }
)
