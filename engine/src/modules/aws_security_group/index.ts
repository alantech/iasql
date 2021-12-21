import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsSecurityGroup1636587967230, } from './migration/1636587967230-aws_security_group'

export const AwsSecurityGroupModule: Module = new Module({
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    entities: allEntities,
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  utils: {
    sgMapper: (sg: any) => {
      const out = new AwsSecurityGroup();
      out.description = sg.Description;
      out.groupName = sg.GroupName;
      out.ownerId = sg.OwnerId;
      out.groupId = sg.GroupId;
      out.vpcId = sg.VpcId;
      return out;
    },
    sgrMapper: async (sgr: any, ctx: Context) => {
      const out = new AwsSecurityGroupRule();
      out.securityGroupRuleId = sgr?.SecurityGroupRuleId;
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
    },
  },
  mappers: {
    securityGroup: new Mapper<AwsSecurityGroup>({
      entity: AwsSecurityGroup,
      entityId: (e: AwsSecurityGroup) => e.groupId ?? '',
      entityPrint: (e: AwsSecurityGroup) => ({
        id: e?.id?.toString() ?? '',
        description: e?.description ?? '',
        groupName: e?.groupName ?? '',
        ownerId: e?.ownerId ?? '',
        groupId: e?.groupId ?? '',
        vpcId: e?.vpcId ?? '',
        securityGroupRules: e?.securityGroupRules?.map(sgr => sgr.securityGroupRuleId ?? '').join(', ') ?? '',
      }),
      equals: (a: AwsSecurityGroup, b: AwsSecurityGroup) => Object.is(a.description, b.description) &&
        Object.is(a.groupName, b.groupName) &&
        Object.is(a.ownerId, b.ownerId) &&
        Object.is(a.groupId, b.groupId) &&
        Object.is(a.vpcId, b.vpcId),
      source: 'db',
      db: new Crud({
        create: (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => ctx.orm.save(AwsSecurityGroup, e),
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['securityGroupRules', 'securityGroupRules.securityGroup'];
          const opts = id ? {
            where: {
              groupId: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(AwsSecurityGroup, opts);
        },
        update: (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => ctx.orm.save(AwsSecurityGroup, e),
        delete: (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => ctx.orm.remove(AwsSecurityGroup, e),
      }),
      cloud: new Crud({
        create: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          return await Promise.all(es.map(async (e) => {
            // Special behavior here. You can't delete the 'default' security group, so if you're
            // trying to create it, something is seriously wrong.
            if (e.groupName === 'default') {
              // We're just gonna get the actual AWS entry for the default security group and
              // shove its properties into the "fake" default security group and re-save it
              // The security group rules associated with the user's created "default" group are
              // still fine to actually set in AWS, so we leave that alone.
              const actualEntity = Object.values(ctx?.memo?.cloud?.AwsSecurityGroup ?? {}).find(
                (a: any) => a.groupName === 'default' && a.groupId !== e.groupId // TODO: Fix typing here
              ) as AwsSecurityGroup;
              e.description = actualEntity.description;
              e.groupId = actualEntity.groupId;
              e.groupName = actualEntity.groupName;
              e.ownerId = actualEntity.ownerId;
              e.vpcId = actualEntity.vpcId;
              await ctx.orm.save(AwsSecurityGroup, e);
              if (e.groupId) {
                ctx.memo.db.AwsSecurityGroup[e.groupId] = e;
              }

              return e;
            }
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
            const newEntity = await AwsSecurityGroupModule.utils.sgMapper(newGroup, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the security group record back into the database to get the new fields updated
            await AwsSecurityGroupModule.mappers.securityGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const sgs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getSecurityGroup(id))) :
            ids === undefined ?
              (await client.getSecurityGroups()).SecurityGroups :
              [await client.getSecurityGroup(ids)];
          return await Promise.all(sgs.map(sg => AwsSecurityGroupModule.utils.sgMapper(sg, ctx)));
        },
        update: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const es = Array.isArray(sg) ? sg : [sg];
          return await Promise.all(es.map(async (e) => {
            // Special behavior here. You're not allowed to mess with the "default" SecurityGroup.
            // You can mess with its rules, but not this record itself, so any attempt to update it
            // is instead turned into *restoring* the value in the database to match the cloud value
            if (e.groupName === 'default') {
              // Because updates are based on the `groupId` matching but not some other property,
              // we can be sure that the security group rules for the default security group are
              // properly associated so we don't need to do anything about them here, just restore
              // the other properties
              const cloudRecord = ctx?.memo?.cloud?.AwsSecurityGroup?.[e.groupId ?? ''];
              cloudRecord.id = e.id;
              await AwsSecurityGroupModule.mappers.securityGroup.db.update(cloudRecord, ctx);
            } else {
              // AWS does not have a way to update the top-level SecurityGroup entity. You can
              // update the various rules associated with it, but not the name or description of the
              // SecurityGroup itself. This may seem counter-intuitive, but we only need to create
              // the security group in AWS and *eventually* the old one will be removed. Why?
              // Because on the second pass of the checking algorithm (it always performs another
              // pass if it performed any change, and only stops once it determines nothing needs to
              // be changed anymore), it will see a security group in AWS that it doesn't have a
              // record for and then remove it since the database is supposed to be the source of
              // truth. Further, because of the relations to the security group being by internal ID
              // in the database instead of the string ID, anything depending on the old security
              // group will be moved to the new one on the second pass. However, there is a unique
              // constraint on the `GroupName`, so a temporary state with a random name may be
              // necessary, so we try-catch this call and mutate as necessary.
              try {
                return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
              } catch (_) {
                // We mutate the `GroupName` to something unique and unlikely to collide (we should
                // be too slow to ever collide at a millisecond level). This path doesn't save back
                // to the DB like create does (at least right now, if that changes, we need to
                // rethink this logic here)
                e.groupName = Date.now().toString();
                return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
              }
            }
          }));
        },
        delete: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          await Promise.all(es.map(async (e) => {
            // Special behavior here. You're not allowed to mess with the "default" SecurityGroup.
            // You can mess with its rules, but not this record itself, so any attempt to update it
            // is instead turned into *restoring* the value in the database to match the cloud value
            if (e.groupName === 'default') {
              // If there is a security group in the database with the 'default' groupName but we
              // are still hitting the 'delete' path, that's a race condition and we should just do
              // nothing here.
              const dbRecord = Object.values(ctx?.memo?.db?.AwsSecurityGroup ?? {}).find(
                (a: any) => a.groupName === 'default'
              );
              if (!!dbRecord) return;
              // For delete, we have un-memoed the record, but the record passed in *is* the one
              // we're interested in, which makes it a bit simpler here
              await AwsSecurityGroupModule.mappers.securityGroup.db.update(e, ctx);
              // Make absolutely sure it shows up in the memo
              ctx.memo.db.AwsSecurityGroup[e.groupId ?? ''] = e;
              const rules = ctx?.memo?.cloud?.AwsSecurityGroupRule ?? [];
              const relevantRules = rules.filter(
                (r: AwsSecurityGroupRule) => r.securityGroup.groupId === e.groupId
              );
              if (relevantRules.length > 0) {
                await AwsSecurityGroupModule.mappers.securityGroupRule.db.update(relevantRules, ctx);
              }
            } else {
              await client.deleteSecurityGroup({
                GroupId: e.groupId,
              });
              // Also need to delete the security group rules associated with this security group,
              // if any
              const rules = await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx);
              const relevantRules = rules.filter(
                (r: AwsSecurityGroupRule) => r.securityGroup.groupId === e.groupId
              );
              await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(relevantRules, ctx);
            }
          }));
        },
      }),
    }),
    securityGroupRule: new Mapper<AwsSecurityGroupRule>({
      entity: AwsSecurityGroupRule,
      entityId: (e: AwsSecurityGroupRule) => e?.securityGroupRuleId ?? e?.id?.toString() ?? '',
      entityPrint: (e: AwsSecurityGroupRule) => ({
        id: e?.id?.toString() ?? '',
        securityGroupRuleId: e?.securityGroupRuleId ?? '',
        securityGroup: e?.securityGroup?.groupName ?? '',
        isEgress: e?.isEgress?.toString() ?? '',
        ipProtocol: e?.ipProtocol ?? '',
        fromPort: e?.fromPort?.toString() ?? '',
        toPort: e?.toPort?.toString() ?? '',
        cidrIpv4: e?.cidrIpv4 ?? '',
        cidrIpv6: e?.cidrIpv6 ?? '',
        prefixListId: e?.prefixListId ?? '',
        description: e?.description ?? '',
      }),
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
        create: (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => ctx.orm.save(AwsSecurityGroupRule, e),
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['securityGroup', 'securityGroup.securityGroupRules',];
          const opts = id ? {
            where: {
              securityGroupRuleId: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(AwsSecurityGroupRule, opts);
        },
        update: (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => ctx.orm.save(AwsSecurityGroupRule, e),
        delete: (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => ctx.orm.remove(AwsSecurityGroupRule, e),
      }),
      cloud: new Crud({
        create: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          // TODO: While the API supports creating multiple security group rules simultaneously,
          // I can't figure out a 100% correct way to identify which created rules are associated
          // with which returned ID to store in the database, so we're doing these sequentially at
          // the moment.
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          for (const en of es) {
            const GroupId = en?.securityGroup?.groupId;
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
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const sgrs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getSecurityGroupRule(id))) :
            ids === undefined ?
              (await client.getSecurityGroupRules()).SecurityGroupRules :
              [await client.getSecurityGroupRule(ids)];
          return await Promise.all(sgrs.map(sgr => AwsSecurityGroupModule.utils.sgrMapper(sgr, ctx)));
        },
        update: async (sgr: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          // First we create new instances of these records, then we delete the old instances
          // To make sure we don't accidentally delete the wrong things, we clone these entities
          const es = Array.isArray(sgr) ? sgr : [sgr];
          const deleteEs = es.map(e => ({ ...e, }));
          await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.create(es, ctx);
          await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.delete(deleteEs, ctx);
        },
        delete: async (sgr: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          const es = Array.isArray(sgr) ? sgr : [sgr];
          const egressDeletesToRun: any = {};
          const ingressDeletesToRun: any = {};
          for (const en of es) {
            const GroupId = en?.securityGroup?.groupId;
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
          for (const GroupId of Object.keys(egressDeletesToRun)) {
            const res = (await client.deleteSecurityGroupEgressRules([{
              GroupId,
              SecurityGroupRuleIds: egressDeletesToRun[GroupId],
            }]))[0];
            if (res.Return !== true) {
              throw new Error(`Failed to remove the security group rules ${res}`);
            }
          }
          for (const GroupId of Object.keys(ingressDeletesToRun)) {
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
    postinstall: awsSecurityGroup1636587967230.prototype.up,
    preremove: awsSecurityGroup1636587967230.prototype.down,
  },
});
