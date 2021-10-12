import { ProcessorFeature as ProcessorFeatureAWS, } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { ProcessorFeature, } from '../entity/processor_feature'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const ProcessorFeatureMapper = new EntityMapper(ProcessorFeature, {
  name: (pf: ProcessorFeatureAWS) => pf.Name,
  value: (pf: ProcessorFeatureAWS) => pf.Value ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
