import {
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
} from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { SecurityGroupMapper, } from './security_group';
import { SecurityGroupRule, } from '../entity/security_group_rule';

export const SecurityGroupRuleMapper = new EntityMapper(SecurityGroupRule, {
  securityGroupRuleId: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.SecurityGroupRuleId,
  groupId: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.GroupId,
  securityGroup: async (sgr: SecurityGroupRuleAWS, i: IndexedAWS) => SecurityGroupMapper.fromAWS(
    i.get('securityGroups', sgr?.GroupId) as SecurityGroupAWS, i
  ),
  isEgress: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.IsEgress,
  ipProtocol: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.IpProtocol,
  fromPort: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.FromPort,
  toPort: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.ToPort,
  cidrIpv4: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv4,
  cidrIpv6: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv6,
  prefixListId: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.PrefixListId,
  description: async (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.Description,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
