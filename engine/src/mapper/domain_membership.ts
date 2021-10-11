import { DomainMembership as DomainMembershipAWS } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { DomainMembership, } from '../entity/domain_membership';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const DomainMembershipMapper = new EntityMapper(DomainMembership, {
  domain: (dm: DomainMembershipAWS, _indexes: IndexedAWS) => dm.Domain ?? null,
  status: (dm: DomainMembershipAWS, _indexes: IndexedAWS) => dm.Status ?? null,
  fqdn: (dm: DomainMembershipAWS, _indexes: IndexedAWS) => dm.FQDN ?? null,
  iamRoleName: (dm: DomainMembershipAWS, _indexes: IndexedAWS) => dm.IAMRoleName ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
