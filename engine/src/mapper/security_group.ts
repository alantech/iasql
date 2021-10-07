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
    // Re-get the inserted security group to get all of the relevant records we care about
    const newGroup = await awsClient.getSecurityGroup(result.GroupId ?? '');
    indexes.set(SecurityGroup, newGroup?.GroupId ?? '', newGroup);
    // We map this into the same kind of entity as `obj`
    const newEntity: SecurityGroup = SecurityGroupMapper.fromAWS(newGroup, indexes);
    // We attach the original object's ID to this new one, indicating the exact record it is
    // replacing in the database
    newEntity.id = obj.id;
    // Then we update the DB cache object with all of these properties so we can perform multiple
    // runs without re-querying the DB
    for (const key of Object.keys(newEntity)) {
      (obj as any)[key] = (newEntity as any)[key];
    }
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // AWS does not have a way to update the top-level SecurityGroup entity. You can update the
    // various rules associated with it, but not the name or description of the SecurityGroup itself
    // This may seem counter-intuitive, but we only need to create the security group in AWS and
    // *eventually* the old one will be removed. Why? Because on the second pass of the checking
    // algorithm (it always performs another pass if it performed any change, and only stops once
    // it determines nothing needs to be changed anymore), it will see a security group in AWS
    // that it doesn't have a record for and then remove it since the database is supposed to be the
    // source of truth. Further, because of the relations to the security group being by internal ID
    // in the database instead of the string ID, anything depending on the old security group will
    // be moved to the new one on the second pass. However, there is a unique constraint on the
    // `GroupName`, so a temporary state with a random name may be necessary, so we try-catch
    // this call and mutate as necessary.
    try {
      return await SecurityGroupMapper.createAWS(obj, awsClient, indexes);
    } catch (_) {
      // We mutate the `GroupName` to something unique and unlikely to collide (we should be too
      // slow to ever collide at a millisecond level). This path doesn't save back to the DB like
      // create does (at least right now, if that changes, we need to rethink this logic here)
      obj.groupName = Date.now().toString();
      return await SecurityGroupMapper.createAWS(obj, awsClient, indexes);
    }
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
