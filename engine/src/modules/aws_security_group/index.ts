import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import { Context, Mapper, ModuleInterface, Crud, } from '../interfaces'
import { awsSecurityGroup1635288398482, } from './migration/1635288398482-aws_security_group'

const sgMapper = async (sg: any, ctx: Context) => {
  const out = new AwsSecurityGroup();
  out.description = sg.Description;
  out.groupName = sg.GroupName;
  out.ownerId = sg.OwnerId;
  out.groupId = sg.GroupId;
  out.vpcId = sg.VpcId;
  out.securityGroupRules = (await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.read(ctx))
    .filter((sgr: AwsSecurityGroupRule) => sgr.groupId === sg.GroupId);
  return out;
};

const sgrMapper = async (sgr: any, ctx: Context) => {
  const out = new AwsSecurityGroupRule();
  out.securityGroupRuleId = sgr?.SecurityGroupRuleId;
  out.groupId = sgr?.GroupId;
  out.securityGroup = await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sgr?.GroupId);
  out.isEgress = sgr?.IsEgress ?? false;
  out.ipProtocol = sgr?.IpProtocol ?? '';
  out.fromPort = sgr?.FromPort;
  out.toPort = sgr?.ToPort;
  out.cidrIpv4 = sgr?.CidrIpv4;
  out.cidrIpv6 = sgr?.CidrIpv6;
  out.prefixListId = sgr?.PrefixListId;
  out.description = sgr?.Description;
  return out;
}

export const AwsSecurityGroupModule: ModuleInterface = {
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  mappers: {
    securityGroup: new Mapper<AwsSecurityGroup>({
      entity: AwsSecurityGroup,
      entityId: (e: AwsSecurityGroup) => e.groupId ?? '',
      equals: (a: AwsSecurityGroup, b: AwsSecurityGroup) => a.description === b.description &&
        a.groupName === b.groupName &&
        a.ownerId === b.ownerId &&
        a.groupId === b.groupId &&
        a.vpcId === b.vpcId,
      source: 'db',
      db: new Crud({
        create: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroup, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsSecurityGroup, options),
        update: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroup, e); },
        delete: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => { await ctx.orm.remove(AwsSecurityGroup, e); },
      }),
      cloud: new Crud({
        create: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          return await Promise.all(es.map(async (e) => {
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
            // AWS automatically creates a default security group rule that we need to keep around
            // Re-get the inserted security group to get all of the relevant records we care about
            const newGroup = await client.getSecurityGroup(result.GroupId ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await sgMapper(newGroup, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database
            newEntity.id = e.id;
            // It's up to the caller if they want to actually update into the DB or not, though.
            return newEntity;
          }));
        },
        read: async (ctx: Context, id?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            if (Array.isArray(id)) {
              return await Promise.all(id.map(async (id) => {
                return await sgMapper(await client.getSecurityGroup(id), ctx);
              }));
            } else {
              return await sgMapper(await client.getSecurityGroup(id), ctx);
            }
          } else {
            const securityGroups = (await client.getSecurityGroups())?.SecurityGroups ?? [];
            return await Promise.all(securityGroups.map((sg: any) => sgMapper(sg, ctx)));
          }
        },
        update: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          return await Promise.all(es.map(async (e) => {
            // AWS does not have a way to update the top-level SecurityGroup entity. You can update
            // the various rules associated with it, but not the name or description of the
            // SecurityGroup itself. This may seem counter-intuitive, but we only need to create the
            // security group in AWS and *eventually* the old one will be removed. Why? Because on
            // the second pass of the checking algorithm (it always performs another pass if it
            // performed any change, and only stops once it determines nothing needs to be changed
            // anymore), it will see a security group in AWS that it doesn't have a record for and
            // then remove it since the database is supposed to be the source of truth. Further,
            // because of the relations to the security group being by internal ID in the database
            // instead of the string ID, anything depending on the old security group will be moved
            // to the new one on the second pass. However, there is a unique constraint on the
            // `GroupName`, so a temporary state with a random name may be necessary, so we
            // try-catch this call and mutate as necessary.
            try {
              return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
            } catch (_) {
              // We mutate the `GroupName` to something unique and unlikely to collide (we should be
              // too slow to ever collide at a millisecond level). This path doesn't save back to
              // the DB like create does (at least right now, if that changes, we need to rethink
              // this logic here)
              e.groupName = Date.now().toString();
              return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          await Promise.all(es.map(async (e) => {
            await client.deleteSecurityGroup({
              GroupId: e.groupId,
            });
          }));
        },
      }),
    }),
    securityGroupRule: new Mapper<AwsSecurityGroupRule>({
      entity: AwsSecurityGroupRule,
      entityId: (e: AwsSecurityGroupRule) => e.securityGroupRuleId + '',
      equals: (_a: AwsSecurityGroupRule, _b: AwsSecurityGroupRule) => true,
      source: 'db',
      db: new Crud({
        create: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsSecurityGroupRule, options),
        update: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        delete: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.remove(AwsSecurityGroupRule, e); },
      }),
      cloud: new Crud({
        create: async (_e: AwsSecurityGroupRule | AwsSecurityGroupRule[], _ctx: Context) => {},
        read: async (ctx: Context, id?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            if (Array.isArray(id)) {
              return await Promise.all(id.map(async (id) => {
                return await sgrMapper(await client.getSecurityGroupRule(id), ctx);
              }));
            } else {
              return await sgrMapper(await client.getSecurityGroupRule(id), ctx);
            }
          } else {
            const securityGroupRules = (await client.getSecurityGroupRules())?.SecurityGroupRules ?? [];
            return await Promise.all(securityGroupRules.map(sgr => sgrMapper(sgr, ctx)));
          }
        },
        update: async (_e: AwsSecurityGroupRule | AwsSecurityGroupRule[], _ctx: Context) => {},
        delete: async (_e: AwsSecurityGroupRule | AwsSecurityGroupRule[], _ctx: Context) => {},
      }),
    }),
  },
  migrations: {
    postinstall: awsSecurityGroup1635288398482.prototype.up,
    preremove: awsSecurityGroup1635288398482.prototype.down,
  },
};
