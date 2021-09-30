import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { UsageClass } from '../entity/usage_class';
import { AWS } from '../services/gateways/aws';

export const UsageClassMapper = new EntityMapper(UsageClass, {
  usageClass: (usageClass: string, _indexes: IndexedAWS) => usageClass ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
