
import { Tag as TagAWS, } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { Tag, } from '../entity/tag';

export const TagMapper = new EntityMapper(Tag, {
  key: async (tag: TagAWS, _indexes: IndexedAWS) => tag?.Key,
  value: async (tag: TagAWS, _indexes: IndexedAWS) => tag?.Value,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
