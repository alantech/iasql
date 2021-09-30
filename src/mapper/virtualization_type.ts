import { VirtualizationType as VirtualizationTypeAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { VirtualizationType } from '../entity/virtualization_type';
import { AWS } from '../services/gateways/aws';

export const VirtualizationTypeMapper = new EntityMapper(VirtualizationType, {
  virtualizationType: (virtualizationType: VirtualizationTypeAWS, _indexes: IndexedAWS) => virtualizationType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
