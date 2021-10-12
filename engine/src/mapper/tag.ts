import { Tag as TagAWS, } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Tag, } from '../entity/tag'

export const TagMapper = new EntityMapper(Tag, {
  key: (tag: TagAWS) => tag?.Key ?? null,
  value: (tag: TagAWS) => tag?.Value ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { /* todo */ },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
