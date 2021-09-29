import { Tag as TagAWS, } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { Tag, } from '../entity/tag';

export const TagMapper = new EntityMapper(Tag, {
  key: (tag: TagAWS, _indexes: IndexedAWS) => tag?.Key,
  value: (tag: TagAWS, _indexes: IndexedAWS) => tag?.Value,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { /* todo */ },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
