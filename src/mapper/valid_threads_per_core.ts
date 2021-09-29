import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { ValidThreadsPerCore, } from '../entity/valid_threads_per_core';

export const ValidThreadsPerCoreMapper = new EntityMapper(ValidThreadsPerCore, {
  count: async (count: number, _indexes: IndexedAWS) => count,
})
