import {
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroup, SecurityGroupRule, } from '../entity'
import { SecurityGroupMapper, } from './security_group'

export const SecurityGroupRuleMapper = new EntityMapper(SecurityGroupRule, {
  securityGroupRuleId: (sgr: SecurityGroupRuleAWS) => sgr?.SecurityGroupRuleId,
  groupId: (sgr: SecurityGroupRuleAWS) => sgr?.GroupId,
  securityGroup: async (sgr: SecurityGroupRuleAWS, a: AWS, i: IndexedAWS) => await SecurityGroupMapper.fromAWS(
    i.get(SecurityGroup, sgr?.GroupId) as SecurityGroupAWS, a, i
  ),
  isEgress: (sgr: SecurityGroupRuleAWS) => sgr?.IsEgress,
  ipProtocol: (sgr: SecurityGroupRuleAWS) => sgr?.IpProtocol ?? null,
  fromPort: (sgr: SecurityGroupRuleAWS) => sgr?.FromPort ?? null,
  toPort: (sgr: SecurityGroupRuleAWS) => sgr?.ToPort ?? null,
  cidrIpv4: (sgr: SecurityGroupRuleAWS) => sgr?.CidrIpv4 ?? null,
  cidrIpv6: (sgr: SecurityGroupRuleAWS) => sgr?.CidrIpv6 ?? null,
  prefixListId: (sgr: SecurityGroupRuleAWS) => sgr?.PrefixListId ?? null,
  description: (sgr: SecurityGroupRuleAWS) => sgr?.Description ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const securityGroupRules = (await awsClient.getSecurityGroupRules())?.SecurityGroupRules ?? [];
    indexes.setAll(SecurityGroupRule, securityGroupRules, 'SecurityGroupRuleId');
    const t2 = Date.now();
    console.log(`SecurityGroupRules set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
