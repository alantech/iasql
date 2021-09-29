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
  ipProtocol: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.IpProtocol,
  fromPort: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.FromPort,
  toPort: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.ToPort,
  cidrIpv4: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv4,
  cidrIpv6: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.CidrIpv6,
  prefixListId: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.PrefixListId,
  description: (sgr: SecurityGroupRuleAWS, _i: IndexedAWS) => sgr?.Description,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
