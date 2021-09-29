import {
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroup, SecurityGroupRule, } from '../entity';

export const SecurityGroupMapper = new EntityMapper(SecurityGroup, {
  description: (sg: SecurityGroupAWS, _i: IndexedAWS) => sg?.Description,
  groupName: (sg: SecurityGroupAWS, _i: IndexedAWS) => sg?.GroupName,
  ownerId: (sg: SecurityGroupAWS, _i: IndexedAWS) => sg?.OwnerId,
  groupId: (sg: SecurityGroupAWS, _i: IndexedAWS) => sg?.GroupId,
  vpcId: (sg: SecurityGroupAWS, _i: IndexedAWS) => sg?.VpcId,
  securityGroupRules: (sg: SecurityGroupAWS, i: IndexedAWS) => Object.values(
    i.get(SecurityGroupRule) as { [key: string]: SecurityGroupRuleAWS }
  ).filter((sgr: SecurityGroupRuleAWS) => sgr?.GroupId === sg?.GroupId),
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
