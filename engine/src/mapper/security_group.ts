import {
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroup, SecurityGroupRule, } from '../entity'

export const SecurityGroupMapper: EntityMapper = new EntityMapper(SecurityGroup, {
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
    indexes.set(SecurityGroup, (newEntity as any).groupId, newEntity);
    // We attach the original object's ID to this new one, indicating the exact record it is
    // replacing in the database
    newEntity.id = obj.id;
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // TODO: To do updates right on this, since AWS doesn't actually support updating the outer
    // records of a security group, we have to delete and recreate, but since other relations will
    // still exist in the database for an update but would not on an actual delete, we will have to
    // temporarily remove any association of the security group from anything that can join on it,
    // which is an unfortunate violation of separation of concerns. At least EC2 instances are a
    // problem, but also likely the weird references to VPNs and likely other services, in AWS, too.
    // For now, though, we'll just ignore and fill this in once it bites us.
    await SecurityGroupMapper.deleteAWS(obj, awsClient, indexes);
    return await SecurityGroupMapper.createAWS(obj, awsClient, indexes);
  },
  deleteAWS: async (obj: SecurityGroup, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.deleteSecurityGroup({
      GroupId: obj.groupId,
    });
    // TODO: What does the error even look like? Docs are spotty on this
    indexes.del(SecurityGroup, (obj as any).groupId);
    return obj;
  },
});
