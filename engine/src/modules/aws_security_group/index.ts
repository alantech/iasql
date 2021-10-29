import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import { Context, MapperInterface, ModuleInterface, } from '../interfaces'
import { awsSecurityGroup1635288398482, } from './migration/1635288398482-aws_security_group'

const memo: { [key: string]: AwsSecurityGroup | AwsSecurityGroupRule, } = {};

const sgMapper = async (sg: any, client: AWS) => {
  const out = new AwsSecurityGroup();
  out.description = sg.Description;
  out.groupName = sg.GroupName;
  out.ownerId = sg.OwnerId;
  out.groupId = sg.GroupId;
  out.vpcId = sg.VpcId;
  out.securityGroupRules = (await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.read(client))
    .filter((sgr: AwsSecurityGroupRule) => sgr.groupId === sg.GroupId);
  return out;
};

export const AwsSecurityGroupModule: ModuleInterface = {
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  mappers: {
    securityGroup: {
      entity: AwsSecurityGroup,
      entityId: (e: AwsSecurityGroup) => e.groupName ?? '',
      source: 'db',
      db: {
        create: async (e: AwsSecurityGroup, ctx: Context) => { await ctx.orm.save(AwsSecurityGroup, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsSecurityGroup, options),
        update: async (e: AwsSecurityGroup, ctx: Context) => { await ctx.orm.save(AwsSecurityGroup, e); },
        delete: async (e: AwsSecurityGroup, ctx: Context) => { await ctx.orm.remove(AwsSecurityGroup, e); },
      },
      cloud: {
        create: async (e: AwsSecurityGroup, ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
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
          const newEntity = await sgMapper(newGroup, client);
          // We attach the original object's ID to this new one, indicating the exact record it is
          // replacing in the database
          newEntity.id = e.id;
          // It's up to the caller if they want to actually update into the DB or not, though.
          return newEntity;
        },
        read: async (ctx: Context, id?: string) => {
          if (id) {
            if (!!memo[`cloud:sg:${id}`]) return memo[`cloud:sg:${id}`];
            return [];
          } else {
            const client = await ctx.getAwsClient() as AWS;
            const securityGroups = (await client.getSecurityGroups())?.SecurityGroups ?? [];
            return await Promise.all(securityGroups.map((sg: any) => sgMapper(sg, client)));
          }
        },
        update: async (e: AwsSecurityGroup, ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
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
            return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, client);
          } catch (_) {
            // We mutate the `GroupName` to something unique and unlikely to collide (we should be too
            // slow to ever collide at a millisecond level). This path doesn't save back to the DB
            // like create does (at least right now, if that changes, we need to rethink this logic
            // here)
            e.groupName = Date.now().toString();
            return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, client);
          }
        },
        delete: async (e: AwsSecurityGroup, ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await client.deleteSecurityGroup({
            GroupId: e.groupId,
          });
        },
      },
    } as MapperInterface<AwsSecurityGroup>,
    securityGroupRule: {
      entity: AwsSecurityGroupRule,
      entityId: (e: AwsSecurityGroupRule) => e.securityGroupRuleId + '',
      source: 'db',
      db: {
        create: async (e: AwsSecurityGroupRule, ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsSecurityGroupRule, options),
        update: async (e: AwsSecurityGroupRule, ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        delete: async (e: AwsSecurityGroupRule, ctx: Context) => { await ctx.orm.remove(AwsSecurityGroupRule, e); },
      },
      cloud: {
        create: async (_e: AwsSecurityGroupRule, _ctx: Context) => {},
        read: async (ctx: Context, id?: string) => {
          if (id) {
            if (!!memo[`cloud:sgr:${id}`]) return memo[`cloud:sgr:${id}`];
            return [];
          } else {
            const client = await ctx.getAwsClient() as AWS;
            const securityGroupRules = (await client.getSecurityGroupRules())?.SecurityGroupRules ?? [];
            return await Promise.all(securityGroupRules.map(async (sgr) => {
              const out = new AwsSecurityGroupRule();
              out.securityGroupRuleId = sgr?.SecurityGroupRuleId ?? '';
              out.groupId = sgr?.GroupId;
              out.securityGroup = await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(client, sgr.GroupOwnerId);
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
        update: async (_e: AwsSecurityGroupRule, _ctx: Context) => {},
        delete: async (_e: AwsSecurityGroupRule, _ctx: Context) => {},
      },
    } as MapperInterface<AwsSecurityGroupRule>,
  },
  migrations: {
    postinstall: awsSecurityGroup1635288398482.prototype.up,
    preremove: awsSecurityGroup1635288398482.prototype.down,
  },
};
