import {
  DBSecurityGroupMembership as DBSecurityGroupMembershipAWS,
} from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { DBSecurityGroup, DBSecurityGroupMembership, SecurityGroup, } from '../entity'
import { DBSecurityGroupMapper, } from '.'

export const DBSecurityGroupMembershipMapper: EntityMapper = new EntityMapper(DBSecurityGroupMembership, {
  dbSecurityGroup: (sgm: DBSecurityGroupMembershipAWS, i: IndexedAWS) => DBSecurityGroupMapper.fromAWS(i.get(DBSecurityGroup, sgm.DBSecurityGroupName), i),
  status: (sgm: DBSecurityGroupMembershipAWS, _i: IndexedAWS) => sgm?.Status ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
