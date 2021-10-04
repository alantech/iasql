import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { ValidCore, } from '../entity/valid_core';
import { AWS } from '../services/gateways/aws';

export const ValidCoreMapper = new EntityMapper(ValidCore, {
  count: (count: number, _indexes: IndexedAWS) => count ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
