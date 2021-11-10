import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
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
  out.fromPort = sgr?.FromPort ?? null;
  out.toPort = sgr?.ToPort ?? null;
  out.cidrIpv4 = sgr?.CidrIpv4 ?? null;
  out.cidrIpv6 = sgr?.CidrIpv6 ?? null;
  out.prefixListId = sgr?.PrefixListId ?? null;
  out.description = sgr?.Description ?? null;
  return out;
}

export const AwsSecurityGroupModule: Module = new Module({
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  mappers: {
    securityGroup: new Mapper<AwsSecurityGroup>({
      entity: AwsSecurityGroup,
      entityId: (e: AwsSecurityGroup) => e.groupId ?? '',
      equals: (a: AwsSecurityGroup, b: AwsSecurityGroup) => Object.is(a.description, b.description) &&
        Object.is(a.groupName, b.groupName) &&
        Object.is(a.ownerId, b.ownerId) &&
        Object.is(a.groupId, b.groupId) &&
        Object.is(a.vpcId, b.vpcId),
      source: 'db',
      db: new Crud({
        create: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          await ctx.orm.save(AwsSecurityGroup, e);
          if (Array.isArray(e)) {
            await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.create(e2.securityGroupRules, ctx)));
          } else {
            await AwsSecurityGroupModule.mappers.securityGroupRule.db.create(e.securityGroupRules, ctx);
          }
        },
        read: async (ctx: Context, options: any) => {
          const sg = await ctx.orm.find(AwsSecurityGroup, options);
          if (Array.isArray(sg)) {
            for (const s of sg) {
              s.securityGroupRules = (
                await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx)
              ).filter((sgr: AwsSecurityGroupRule) => sgr.groupId === s.groupId);
              s.securityGroupRules.forEach((sgr: AwsSecurityGroupRule) => sgr.securityGroup = s);
            }
          } else {
            sg.securityGroupRules = (
              await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx)
            ).filter((sgr: AwsSecurityGroupRule) => sgr.groupId === sg.groupId);
            sg.securityGroupRules.forEach((sgr: AwsSecurityGroupRule) => sgr.securityGroup = sg);
          }
          return sg;
        },
        update: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          await ctx.orm.save(AwsSecurityGroup, e);
          if (Array.isArray(e)) {
            await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.update(e2.securityGroupRules, ctx)));
          } else {
            await AwsSecurityGroupModule.mappers.securityGroupRule.db.update(e.securityGroupRules, ctx);
          }
        },
        delete: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          if (Array.isArray(e)) {
            await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(e2.securityGroupRules, ctx)));
          } else {
            await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(e.securityGroupRules, ctx);
          }
          await ctx.orm.remove(AwsSecurityGroup, e);
        },
      }),
      cloud: new Crud({
        create: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          const out = await Promise.all(es.map(async (e) => {
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
            const newEntity = await sgMapper(newGroup, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database, and also make a proper, complete loop for it as the rules
            // reference their parent in a circular fashion.
            newEntity.id = e.id;
            if (e.securityGroupRules?.length > 0) newEntity.securityGroupRules = [ ...e.securityGroupRules];
            await Promise.all(newEntity.securityGroupRules.map(async (sgr) => {
              // First, remove the old security group rule from the database
              await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(sgr, ctx);
              // Now edit this entity so it can be recreated in the database appropriately
              sgr.securityGroup = newEntity;
              sgr.groupId = newEntity.groupId; // TODO: Eliminate this field
              delete sgr.id; // So it gets properly recreated for the new entity
            }));
            // Save the security group record back into the database to get the new fields updated
            await AwsSecurityGroupModule.mappers.securityGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(e)) {
            return out;
          } else {
            return out[0];
          }
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
            // Also need to delete the security group rules associated with this security group,
            // if any
            const rules = await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx);
            const relevantRules = rules.filter((r: AwsSecurityGroupRule) => r.groupId === e.groupId);
            await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(relevantRules, ctx);
          }));
        },
      }),
    }),
    securityGroupRule: new Mapper<AwsSecurityGroupRule>({
      entity: AwsSecurityGroupRule,
      entityId: (e: AwsSecurityGroupRule) => e.securityGroupRuleId + '',
      equals: (a: AwsSecurityGroupRule, b: AwsSecurityGroupRule) => Object.is(a.isEgress, b.isEgress) &&
        Object.is(a.ipProtocol, b.ipProtocol) &&
        Object.is(a.fromPort, b.fromPort) &&
        Object.is(a.toPort, b.toPort) &&
        Object.is(a.cidrIpv4, b.cidrIpv4) &&
        Object.is(a.cidrIpv6, b.cidrIpv6) &&
        Object.is(a.prefixListId, b.prefixListId) &&
        Object.is(a.description, b.description),
      source: 'db',
      db: new Crud({
        create: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsSecurityGroupRule, options),
        update: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.save(AwsSecurityGroupRule, e); },
        delete: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => { await ctx.orm.remove(AwsSecurityGroupRule, e); },
      }),
      cloud: new Crud({
        create: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          // TODO: While the API supports creating multiple security group rules simultaneously,
          // I can't figure out a 100% correct way to identify which created rules are associated
          // with which returned ID to store in the database, so we're doing these sequentially at
          // the moment.
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          for (let en of es) {
            // TODO: Drop the duplicate groupId
            const GroupId = en?.securityGroup?.groupId ?? en.groupId;
            if (!GroupId) throw new Error(
              'Cannot create a security group rule for a security group that does not yet exist'
            );
            const newRule: any = {};
            // The rest of these should be defined if present
            if (en.cidrIpv4) newRule.IpRanges = [{ CidrIp: en.cidrIpv4, }];
            if (en.cidrIpv6) newRule.Ipv6Ranges = [{ CidrIpv6: en.cidrIpv6, }];
            if (en.description) {
              if (en.cidrIpv4) newRule.IpRanges[0].Description = en.description;
              if (en.cidrIpv6) newRule.Ipv6Ranges[0].Description = en.description;
            }
            if (en.fromPort) newRule.FromPort = en.fromPort;
            if (en.ipProtocol) newRule.IpProtocol = en.ipProtocol;
            if (en.prefixListId) newRule.PrefixListIds = [en.prefixListId];
            // TODO: There's something weird about `ReferencedGroupId` that I need to dig into
            if (en.toPort) newRule.ToPort = en.toPort;
            let res;
            if (en.isEgress) {
              res = (await client.createSecurityGroupEgressRules([{
                GroupId,
                IpPermissions: [newRule],
              }]))[0];
            } else {
              res = (await client.createSecurityGroupIngressRules([{
                GroupId,
                IpPermissions: [newRule],
              }]))[0];
            }
            // Now to either throw on error or save the cloud-generated fields
            if (res.Return !== true || res.SecurityGroupRules?.length === 0) {
              throw new Error(`Unable to create security group rule`);
            }
            en.securityGroupRuleId = res.SecurityGroupRules?.[0].SecurityGroupRuleId;
            // TODO: Are there any other fields to update?
            await AwsSecurityGroupModule.mappers.securityGroupRule.db.update(en, ctx);
          }
        },
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
        update: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          // First we create new instances of these records, then we delete the old instances
          // To make sure we don't accidentally delete the wrong things, we clone these entities
          const es = Array.isArray(e) ? e : [e];
          const deleteEs = es.map(e => ({ ...e, }));
          await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.create(es, ctx);
          await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.delete(deleteEs, ctx);
        },
        delete: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          const egressDeletesToRun: any = {};
          const ingressDeletesToRun: any = {};
          for (let en of es) {
            // TODO: Drop the duplicate groupId
            const GroupId = en?.securityGroup?.groupId ?? en.groupId;
            if (!GroupId) throw new Error(
              'Cannot create a security group rule for a security group that does not yet exist'
            );
            if (en.isEgress) {
              egressDeletesToRun[GroupId] = egressDeletesToRun[GroupId] ?? [];
              egressDeletesToRun[GroupId].push(en.securityGroupRuleId);
            } else {
              ingressDeletesToRun[GroupId] = ingressDeletesToRun[GroupId] ?? [];
              ingressDeletesToRun[GroupId].push(en.securityGroupRuleId);
            }
          }
          const client = await ctx.getAwsClient() as AWS;
          for (let GroupId of Object.keys(egressDeletesToRun)) {
            const res = (await client.deleteSecurityGroupEgressRules([{
              GroupId,
              SecurityGroupRuleIds: egressDeletesToRun[GroupId],
            }]))[0];
            if (res.Return !== true) {
              throw new Error(`Failed to remove the security group rules ${res}`);
            }
          }
          for (let GroupId of Object.keys(ingressDeletesToRun)) {
            const res = (await client.deleteSecurityGroupIngressRules([{
              GroupId,
              SecurityGroupRuleIds: ingressDeletesToRun[GroupId],
            }]))[0];
            if (res.Return !== true) {
              throw new Error(`Failed to remove the security group rules ${res}`);
            }
          }
          // Once the old version is deleted, remove it from the DB memo cache, too
          // TODO: Figure out how to automate the memoization issue here and the general TypeORM
          // wonkiness with circularly-dependent entities.
          es.forEach(e => {
            const oldId = AwsSecurityGroupModule.mappers.securityGroupRule.entityId(e);
            delete ctx.memo.db.AwsSecurityGroupRule[oldId];
          });
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsSecurityGroup1635288398482.prototype.up,
    preremove: awsSecurityGroup1635288398482.prototype.down,
  },
});
