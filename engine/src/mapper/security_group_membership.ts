import {
  VpcSecurityGroupMembership,
} from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroupMembership, SecurityGroup, } from '../entity'
import { SecurityGroupMapper, } from '.'

export const SecurityGroupMembershipMapper: EntityMapper = new EntityMapper(SecurityGroupMembership, {
  securityGroup: async (sgm: VpcSecurityGroupMembership, awsClient: AWS, i: IndexedAWS) => await SecurityGroupMapper.fromAWS(
    i.getOr(SecurityGroup, sgm.VpcSecurityGroupId!, awsClient.getSecurityGroup.bind(awsClient)), awsClient, i),
  status: (sgm: VpcSecurityGroupMembership) => sgm?.Status ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
