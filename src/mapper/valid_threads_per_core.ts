import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { ValidThreadsPerCore, } from '../entity/valid_threads_per_core';
import { AWS } from '../services/gateways/aws';

export const ValidThreadsPerCoreMapper = new EntityMapper(ValidThreadsPerCore, {
  count: (count: number, _indexes: IndexedAWS) => count ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
