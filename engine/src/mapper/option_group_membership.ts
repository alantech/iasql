import {
  OptionGroupMembership as OptionGroupMembershipAWS,
} from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { OptionGroupMembership, } from '../entity'

export const OptionGroupMembershipMapper: EntityMapper = new EntityMapper(OptionGroupMembership, {
  optionGroupName: (og: OptionGroupMembershipAWS) => og?.OptionGroupName ?? null,
  status: (og: OptionGroupMembershipAWS) => og?.Status ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
