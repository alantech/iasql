import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import { MapperInterface, ModuleInterface, } from '../interfaces'
import { TypeormWrapper, } from '../../services/typeorm'
import { awsSecurityGroup1635288398482, } from './migration/1635288398482-aws_security_group'
import { SecurityGroupMapper } from '../../mapper/security_group'

const memo: { [key: string]: AwsSecurityGroup | AwsSecurityGroupRule, } = {};

export const AwsSecurityGroupModule: ModuleInterface = {
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  mappers: [{
    entity: AwsSecurityGroup,
    source: 'db',
    db: {
      create: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.save(AwsSecurityGroup, e); },
      read: (client: TypeormWrapper, options: any) => client.find(AwsSecurityGroup, options),
      update: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.save(AwsSecurityGroup, e); },
      delete: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.remove(AwsSecurityGroup, e); },
    },
    cloud: {
      mapper: async (sg: any, client: AWS) => {
        const out = new AwsSecurityGroup();
        out.description = sg.Description;
        out.groupName = sg.GroupName;
        out.ownerId = sg.OwnerId;
        out.groupId = sg.GroupId;
        out.vpcId = sg.VpcId;
        out.securityGroupRules = (await AwsSecurityGroupModule.mappers[1].cloud.read(client))
          .filter((sgr: AwsSecurityGroupRule) => sgr.groupId === sg.GroupId);
        return out;
      },
      create: async (e: AwsSecurityGroup, client: AWS) => {
        // First construct the security group
        const result = await client.createSecurityGroup({
          Description: e.description,
          GroupName: e.groupName,
          VpcId: e.vpcId,
          // TODO: Tags
        });
        // TODO: Handle if it fails (somehow)
        if (!result.hasOwnProperty('GroupId')) { // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted security group to get all of the relevant records we care about
        const newGroup = await client.getSecurityGroup(result.GroupId ?? '');
        // We map this into the same kind of entity as `obj`
        const newEntity = await AwsSecurityGroupModule.mappers[0].cloud.mapper?.(newGroup, client);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database
        newEntity.id = e.id;
        // It's up to the caller if they want to actually update into the DB or not, though.
        return newEntity;
      },
      read: async (client: AWS, id?: string) => {
        if (id) {
          if (!!memo[`cloud:sg:${id}`]) return memo[`cloud:sg:${id}`];
          return [];
        } else {
          const securityGroups = (await client.getSecurityGroups())?.SecurityGroups ?? [];
          return await Promise.all(securityGroups.map((sg: any) => AwsSecurityGroupModule.mappers[0].cloud.mapper?.(sg, client)));
        }
      },
      update: async (e: AwsSecurityGroup, client: AWS) => {
        // AWS does not have a way to update the top-level SecurityGroup entity. You can update the
        // various rules associated with it, but not the name or description of the SecurityGroup
        // itself. This may seem counter-intuitive, but we only need to create the security group in
        // AWS and *eventually* the old one will be removed. Why? Because on the second pass of the
        // checking algorithm (it always performs another pass if it performed any change, and only
        // stops once it determines nothing needs to be changed anymore), it will see a security
        // group in AWS that it doesn't have a record for and then remove it since the database is
        // supposed to be the source of truth. Further, because of the relations to the security
        // group being by internal ID in the database instead of the string ID, anything depending
        // on the old security group will be moved to the new one on the second pass. However, there
        // is a unique constraint on the `GroupName`, so a temporary state with a random name may be
        // necessary, so we try-catch this call and mutate as necessary.
        try {
          return await AwsSecurityGroupModule.mappers[0].cloud.create(e, client);
        } catch (_) {
          // We mutate the `GroupName` to something unique and unlikely to collide (we should be too
          // slow to ever collide at a millisecond level). This path doesn't save back to the DB
          // like create does (at least right now, if that changes, we need to rethink this logic
          // here)
          e.groupName = Date.now().toString();
          return await AwsSecurityGroupModule.mappers[0].cloud.create(e, client);
        }
      },
      delete: async (e: AwsSecurityGroup, client: AWS) => {
        await client.deleteSecurityGroup({
          GroupId: e.groupId,
        });
      },
    },
  } as MapperInterface<AwsSecurityGroup, TypeormWrapper, AWS>, {
    entity: AwsSecurityGroupRule,
    source: 'db',
    db: {
      create: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.save(AwsSecurityGroupRule, e); },
      read: (client: TypeormWrapper, options: any) => client.find(AwsSecurityGroupRule, options),
      update: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.save(AwsSecurityGroupRule, e); },
      delete: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.remove(AwsSecurityGroupRule, e); },
    },
    cloud: {
      create: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
      read: async (client: AWS, id?: string) => {
        if (id) {
          if (!!memo[`cloud:sgr:${id}`]) return memo[`cloud:sgr:${id}`];
          return [];
        } else {
          const securityGroupRules = (await client.getSecurityGroupRules())?.SecurityGroupRules ?? [];
          return await Promise.all(securityGroupRules.map(async (sgr) => {
            const out = new AwsSecurityGroupRule();
            out.securityGroupRuleId = sgr?.SecurityGroupRuleId ?? '';
            out.groupId = sgr?.GroupId;
            out.securityGroup = await AwsSecurityGroupModule.mappers[0].cloud.read(client, sgr.GroupOwnerId);
            out.isEgress = sgr?.IsEgress ?? false;
            out.ipProtocol = sgr?.IpProtocol ?? '';
            out.fromPort = sgr?.FromPort ?? -1;
            out.toPort = sgr?.ToPort ?? -1;
            out.cidrIpv4 = sgr?.CidrIpv4 ?? '';
            out.cidrIpv6 = sgr?.CidrIpv6 ?? '';
            out.prefixListId = sgr?.PrefixListId ?? '';
            out.description = sgr?.Description ?? '';
            memo[`cloud:sgr:${out.securityGroupRuleId}`] = out;
            return out;
          }));
        }
      },
      update: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
      delete: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
    },
  } as MapperInterface<AwsSecurityGroupRule, TypeormWrapper, AWS>],
  migrations: {
    postinstall: awsSecurityGroup1635288398482.prototype.up,
    preremove: awsSecurityGroup1635288398482.prototype.down,
  },
};
