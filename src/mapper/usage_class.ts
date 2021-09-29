import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { UsageClass } from '../entity/usage_class';

export const UsageClassMapper = new EntityMapper(UsageClass, {
  usageClass: async (usageClass: string, _indexes: IndexedAWS) => usageClass,
})
