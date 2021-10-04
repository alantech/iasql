import {
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroupMapper, } from './security_group';
import { SecurityGroup, SecurityGroupRule, } from '../entity';

export const SecurityGroupRuleMapper = new EntityMapper(SecurityGroupRule, {
  securityGroupRuleId: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.SecurityGroupRuleId,
  groupId: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.GroupId,
  securityGroup: (sgr: SecurityGroupRuleAWS, i: IndexedAWS) => SecurityGroupMapper.fromAWS(
    i.get(SecurityGroup, sgr?.GroupId) as SecurityGroupAWS, i
  ),
  isEgress: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.IsEgress,
  ipProtocol: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.IpProtocol ?? null,
  fromPort: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.FromPort ?? null,
  toPort: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.ToPort ?? null,
  cidrIpv4: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv4 ?? null,
  cidrIpv6: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv6 ?? null,
  prefixListId: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.PrefixListId ?? null,
  description: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.Description ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const securityGroupRules = (await awsClient.getSecurityGroupRules())?.SecurityGroupRules ?? [];
    indexes.setAll(SecurityGroupRule, securityGroupRules, 'SecurityGroupRuleId');
    const t2 = Date.now();
    console.log(`SecurityGroupRules set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
