import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { ValidCore, } from '../entity/valid_core';

export const ValidCoreMapper = new EntityMapper(ValidCore, {
  count: async (count: number, _indexes: IndexedAWS) => count,
})
