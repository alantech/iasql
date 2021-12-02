import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsSecurityGroup1636587967230, } from './migration/1636587967230-aws_security_group'
import { DepError } from '../../services/lazy-dep'

export const AwsSecurityGroupModule: Module = new Module({
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    entities: allEntities,
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  utils: {
    sgMapper: async (sg: any, ctx: Context) => {
      const out = new AwsSecurityGroup();
      out.description = sg.Description;
      out.groupName = sg.GroupName;
      out.ownerId = sg.OwnerId;
      out.groupId = sg.GroupId;
      out.vpcId = sg.VpcId;
      // const securityGroupRules = await AwsSecurityGroupModule.mappers.securityGroupRule.cloud.read(ctx);
      // out.securityGroupRules = securityGroupRules
      //   .filter((sgr: AwsSecurityGroupRule) => {
      //     return sgr.securityGroup.groupId === sg.GroupId
      //   });
      // console.dir({rules: out.securityGroupRules},{depth:4})
      return out;
    },
    sgrMapper: async (sgr: any, ctx: Context) => {
      const out = new AwsSecurityGroupRule();
      out.securityGroupRuleId = sgr?.SecurityGroupRuleId;
      out.securityGroup = await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sgr?.GroupId);
      if (!out.securityGroup?.groupId) {
        console.log(`Deleting memo ${JSON.stringify(ctx.memo?.cloud?.SecurityGroup?.[sgr?.GroupId])}`)
        // delete ctx.memo?.cloud?.SecurityGroup?.[sgr?.GroupId];
        console.log(`After deleting memo ${JSON.stringify(ctx.memo?.cloud?.SecurityGroup?.[sgr?.GroupId])}`)
        // throw new DepError('Sg need to be loaded');
      }
      console.dir({group: out.securityGroup},{depth:4})
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
      equals: (a: AwsSecurityGroup, b: AwsSecurityGroup) => Object.is(a.description, b.description) &&
        Object.is(a.groupName, b.groupName) &&
        Object.is(a.ownerId, b.ownerId) &&
        Object.is(a.groupId, b.groupId) &&
        Object.is(a.vpcId, b.vpcId),
      source: 'db',
      db: new Crud({
        create: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          await ctx.orm.save(AwsSecurityGroup, e);
          // if (Array.isArray(e)) {
          //   await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.create(e2.securityGroupRules, ctx)));
          // } else {
          //   await AwsSecurityGroupModule.mappers.securityGroupRule.db.create(e.securityGroupRules, ctx);
          // }
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          // console.log(`getting sg with id ${id}`)
          // console.dir(ctx?.memo?.AwsSecurityGroup, {depth:5})
          const relations = ['securityGroupRules', 'securityGroupRules.securityGroup'];
          const opts = id ? {
            where: {
              groupId: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          const sg = (!id || Array.isArray(id)) ? await ctx.orm.find(AwsSecurityGroup, opts) : await ctx.orm.findOne(AwsSecurityGroup, opts);
          // console.dir({ name: 'sg', sg }, {depth:4});
          return sg;
          // if (Array.isArray(sg)) {
          //   for (const s of sg) {
          //     const sgrIds = (await ctx.orm.query(`
          //       select sgr.security_group_rule_id
          //       from aws_security_group_rule sgr
          //       where sgr.security_group_id = ${s.id}
          //     `)).map((r: any) => r.security_group_rule_id);
          //     const filteredSgrIds = sgrIds.filter((sgrId: string) => !!sgrId);
          //     if (filteredSgrIds.length > 0) {
          //       s.securityGroupRules = await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx, filteredSgrIds);
          //       s.securityGroupRules.forEach((sgr: AwsSecurityGroupRule) => sgr.securityGroup = s);
          //     }
          //   }
          // } else {
          //   const sgrIds = (await ctx.orm.query(`
          //     select sgr.security_group_rule_id
          //     from aws_security_group_rule sgr
          //     where sgr.security_group_id = ${sg.id}
          //   `)).map((r: any) => r.security_group_rule_id);
          //     const filteredSgrIds = sgrIds.filter((sgrId: string) => !!sgrId);
          //     if (sgrIds.length > 0) {
          //     sg.securityGroupRules = await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx, filteredSgrIds);
          //     sg.securityGroupRules.forEach((sgr: AwsSecurityGroupRule) => sgr.securityGroup = sg);
          //   }
          // }
          // return sg;
        },
        update: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          // console.log('what i am going to update')
          // console.dir(e, {depth:4})
          await ctx.orm.save(AwsSecurityGroup, e);
          // if (Array.isArray(e)) {
          //   await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.update(e2.securityGroupRules, ctx)));
          // } else {
          //   await AwsSecurityGroupModule.mappers.securityGroupRule.db.update(e.securityGroupRules, ctx);
          // }
        },
        delete: async (e: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          // if (Array.isArray(e)) {
          //   await Promise.all(e.map(e2 => AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(e2.securityGroupRules, ctx)));
          // } else {
          //   await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(e.securityGroupRules, ctx);
          // }
          await ctx.orm.remove(AwsSecurityGroup, e);
        },
      }),
      cloud: new Crud({
        create: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
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
            const newEntity = await AwsSecurityGroupModule.utils.sgMapper(newGroup, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database, and also make a proper, complete loop for it as the rules
            // reference their parent in a circular fashion.
            newEntity.id = e.id;
            // console.dir({newsgr: e.securityGroupRules},{depth:4})
            // if (e.securityGroupRules?.length > 0) newEntity.securityGroupRules = [...e.securityGroupRules];
            // await Promise.all(newEntity.securityGroupRules.map(async (sgr: AwsSecurityGroupRule) => {
            //   // First, remove the old security group rule from the database
            //   if (sgr.hasOwnProperty('id')) {
            //     await AwsSecurityGroupModule.mappers.securityGroupRule.db.delete(sgr, ctx);
            //   }
            //   // Now edit this entity so it can be recreated in the database appropriately
            //   sgr.securityGroup = newEntity;
            //   delete sgr.id; // So it gets properly recreated for the new entity
            // }));
            // Save the security group record back into the database to get the new fields updated
            await AwsSecurityGroupModule.mappers.securityGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(sg)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsSecurityGroupModule.utils.sgMapper(
                  await client.getSecurityGroup(id), ctx
                );
              }));
            } else {
              return await AwsSecurityGroupModule.utils.sgMapper(
                await client.getSecurityGroup(ids), ctx
              );
            }
          } else {
            const securityGroups = (await client.getSecurityGroups())?.SecurityGroups ?? [];
            return await Promise.all(
              securityGroups.map((sg: any) => AwsSecurityGroupModule.utils.sgMapper(sg, ctx))
            );
          }
        },
        update: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const es = Array.isArray(sg) ? sg : [sg];
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
        delete: async (sg: AwsSecurityGroup | AwsSecurityGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          await Promise.all(es.map(async (e) => {
            await client.deleteSecurityGroup({
              GroupId: e.groupId,
            });
            // Also need to delete the security group rules associated with this security group,
            // if any
            const rules = await AwsSecurityGroupModule.mappers.securityGroupRule.db.read(ctx);
            const relevantRules = rules.filter((r: AwsSecurityGroupRule) => r.securityGroup.groupId === e.groupId);
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
        create: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          await ctx.orm.save(AwsSecurityGroupRule, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          // console.log(`getting sgr with id ${id}`)
          const relations = ['securityGroup', 'securityGroup.securityGroupRules',];
          const opts = id ? {
            where: {
              securityGroupRuleId: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          const sgr = (!id || Array.isArray(id)) ? await ctx.orm.find(AwsSecurityGroupRule, opts) : await ctx.orm.findOne(AwsSecurityGroupRule, opts);
          // console.dir({ name: 'sgr', sgr }, {depth:4});
          return sgr;
          // if (Array.isArray(sgr)) {
          //   // This is ridiculous. Why can't I access the `security_group_id` field directly?
          //   await Promise.all(sgr.map(async (o: AwsSecurityGroupRule) => {
          //     const sgId = (await ctx.orm.query(`
          //       select sg.group_id
          //       from aws_security_group sg
          //       inner join aws_security_group_rule sgr on sgr.security_group_id = sg.id
          //       where sgr.id = ${o.id}
          //     `))[0]?.group_id;
          //     // if (!sgId) throw new DepError('Security group need to be created first');
          //     o.securityGroup = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId);
          //   }));
          // } else {
          //   // This is ridiculous. Why can't I access the `security_group_id` field directly?
          //   const sgId = (await ctx.orm.query(`
          //     select sg.group_id
          //     from aws_security_group sg
          //     inner join aws_security_group_rule sgr on sgr.security_group_id = sg.id
          //     where sgr.id = ${sgr.id}
          //   `))[0]?.group_id;
          //   // if (!sgId) throw new DepError('Security group need to be created first');
          //   sgr.securityGroup = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId);
          // }
          // return sgr;
        },
        update: async (e: AwsSecurityGroupRule | AwsSecurityGroupRule[], ctx: Context) => {
          // console.log('SGR update');
          // console.dir(e, {depth:5});
          await ctx.orm.save(AwsSecurityGroupRule, e); },
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
          console.log(`is it a list? it should len = ${es.length}`)
          console.dir(es)
          for (const en of es) {
            console.log('cloud create sgr');
            console.dir(en, {depth:5})
            const GroupId = en?.securityGroup?.groupId;
            if (!GroupId) {
              console.log('thowing this error because my security group does not have group')
              throw new Error(
                'Cannot create a security group rule for a security group that does not yet exist'
              );
            }
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
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsSecurityGroupModule.utils.sgrMapper(
                  await client.getSecurityGroupRule(id), ctx
                );
              }));
            } else {
              return await AwsSecurityGroupModule.utils.sgrMapper(
                await client.getSecurityGroupRule(ids), ctx
              );
            }
          } else {
            const securityGroupRules = (await client.getSecurityGroupRules())?.SecurityGroupRules ?? [];
            try {
              return await Promise.all(
                securityGroupRules.map(sgr => AwsSecurityGroupModule.utils.sgrMapper(sgr, ctx))
              );
            } catch (e) {
              console.log('error here')
              console.error(e)
              throw e
            }
          }
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
