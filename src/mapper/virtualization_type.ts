import { VirtualizationType as VirtualizationTypeAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { VirtualizationType } from '../entity/virtualization_type';

export const VirtualizationTypeMapper = new EntityMapper(VirtualizationType, {
  virtualizationType: async (virtualizationType: VirtualizationTypeAWS, _indexes: IndexedAWS) => virtualizationType,
})
