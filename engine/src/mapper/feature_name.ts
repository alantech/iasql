import { AWS, } from '../services/gateways/aws'
import { FeatureName, } from '../entity/feature_name';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const FeatureNameMapper = new EntityMapper(FeatureName, {
  name: (name: string, _indexes: IndexedAWS) => name,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
