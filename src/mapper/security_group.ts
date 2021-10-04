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
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const securityGroups = (await awsClient.getSecurityGroups())?.SecurityGroups ?? [];
    indexes.setAll(SecurityGroup, securityGroups, 'GroupId');
    const t2 = Date.now();
    console.log(`SecurityGroups set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: SecurityGroup, awsClient: AWS, indexes: IndexedAWS) => {
    // First construct the security group
    const result = await awsClient.createSecurityGroup({
      Description: obj.description,
      GroupName: obj.groupName,
      VpcId: obj.vpcId,
      // TODO: Tags
    });
    // TODO: Handle if it fails (somehow)
    if (!result.hasOwnProperty('GroupId')) { // Failure
      throw new Error('what should we do here?');
    }
    // TODO: Determine if the following logic really belongs here or not
    // Re-get the inserted security group to get all of the relevant records we care about
    const newGroup = await awsClient.getSecurityGroup(result.GroupId ?? '');
    // We map this into the same kind of entity as `obj`
    const newEntity: SecurityGroup = SecurityGroupMapper.fromAWS(newGroup, indexes);
    // We attach the original object's ID to this new one, indicating the exact record it is
    // replacing in the database
    newEntity.id = obj.id;
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
