import e from 'cors';

import {
  AuthorizeSecurityGroupEgressCommandInput,
  AuthorizeSecurityGroupIngressCommandInput,
  DeleteSecurityGroupRequest,
  EC2,
  RevokeSecurityGroupEgressCommandInput,
  RevokeSecurityGroupIngressCommandInput,
  SecurityGroup as AwsSecurityGroup,
  SecurityGroupRule as AwsSecurityGroupRule,
  paginateDescribeSecurityGroupRules,
  paginateDescribeSecurityGroups,
  IpPermission,
  PrefixList,
  PrefixListId,
} from '@aws-sdk/client-ec2';

import { AWS, crudBuilder2, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import logger from '../../../services/logger';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsVpcModule } from '../aws_vpc';
import { Vpc } from '../aws_vpc/entity';
import { SecurityGroup, SecurityGroupRule } from './entity';

class SecurityGroupMapper extends MapperBase<SecurityGroup> {
  module: AwsSecurityGroupModule;
  entity = SecurityGroup;
  equals = (a: SecurityGroup, b: SecurityGroup) =>
    Object.is(a.description, b.description) &&
    Object.is(a.groupName, b.groupName) &&
    Object.is(a.ownerId, b.ownerId) &&
    Object.is(a.groupId, b.groupId) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId);

  async sgMapper(sg: any, ctx: Context) {
    const out = new SecurityGroup();
    out.description = sg.Description;
    out.groupName = sg.GroupName;
    out.ownerId = sg.OwnerId;
    out.groupId = sg.GroupId;
    if (sg.VpcId) {
      out.vpc =
        (await awsVpcModule.vpc.db.read(ctx, sg.VpcId)) ?? (await awsVpcModule.vpc.cloud.read(ctx, sg.VpcId));
      if (!out.vpc) throw new Error(`Waiting for VPC ${sg.VpcId}`);
    }
    return out;
  }

  async sgCloudCreate(es: SecurityGroup[], ctx: Context, doNotSave: boolean) {
    // This is popped out into a util so we can change its behavior when used as part of a
    // cloud `replace` involving a collision of a unique-constrained identifier (the `groupName`)
    const client = (await ctx.getAwsClient()) as AWS;
    const out = [];
    for (const e of es) {
      // Special behavior here. You can't delete the 'default' security group, so if you're
      // trying to create it, something is seriously wrong.
      if (e.groupName === 'default') {
        // We're just gonna get the actual AWS entry for the default security group and
        // shove its properties into the "fake" default security group and re-save it
        // The security group rules associated with the user's created "default" group are
        // still fine to actually set in AWS, so we leave that alone.
        const actualEntity = Object.values(ctx?.memo?.cloud?.SecurityGroup ?? {}).find(
          (a: any) => a.groupName === 'default' && a.vpc?.vpcId === e.vpc?.vpcId, // TODO: Fix typing here
        ) as SecurityGroup;
        e.description = actualEntity.description;
        e.groupId = actualEntity.groupId;
        e.groupName = actualEntity.groupName;
        e.ownerId = actualEntity.ownerId;
        e.vpc = actualEntity.vpc;
        await ctx.orm.save(SecurityGroup, e);
        if (e.groupId) {
          ctx.memo.db.SecurityGroup[e.groupId] = e;
        }

        out.push(e);
        continue;
      }
      if (!e.vpc) {
        const vpcs: Vpc[] = await awsVpcModule.vpc.cloud.read(ctx);
        if (!vpcs.length) {
          throw new Error('Vpcs need to be loaded first');
        }
        const defaultVpc = vpcs.find((vpc: Vpc) => vpc.isDefault === true);
        e.vpc = defaultVpc;
        await ctx.orm.save(SecurityGroup, e);
        if (e.groupId) {
          ctx.memo.db.SecurityGroup[e.groupId] = e;
        }
      }
      // First construct the security group
      const result = await this.createSecurityGroup(client.ec2client, {
        Description: e.description,
        GroupName: e.groupName,
        VpcId: e.vpc?.vpcId,
        // TODO: Tags
      });
      // TODO: Handle if it fails (somehow)
      if (!result?.hasOwnProperty('GroupId')) {
        // Failure
        throw new Error('what should we do here?');
      }
      // Re-get the inserted security group to get all of the relevant records we care about
      const newGroup = await this.getSecurityGroup(client.ec2client, result.GroupId ?? '');
      if (!newGroup) continue;
      // We map this into the same kind of entity as `obj`
      const newEntity = await this.sgMapper(newGroup, ctx);
      if (doNotSave) return [newEntity];
      // We attach the original object's ID to this new one, indicating the exact record it is
      // replacing in the database.
      newEntity.id = e.id;
      // Save the security group record back into the database to get the new fields updated
      await this.module.securityGroup.db.update(newEntity, ctx);
      out.push(newEntity);
    }
    return out;
  }

  createSecurityGroup = crudBuilder2<EC2, 'createSecurityGroup'>('createSecurityGroup', input => input);
  getSecurityGroup = crudBuilderFormat<EC2, 'describeSecurityGroups', AwsSecurityGroup | undefined>(
    'describeSecurityGroups',
    id => ({ GroupIds: [id] }),
    res => res?.SecurityGroups?.[0],
  );
  getSecurityGroupByName = crudBuilderFormat<EC2, 'describeSecurityGroups', AwsSecurityGroup | undefined>(
    'describeSecurityGroups',
    name => ({ GroupNames: [name] }),
    res => res?.SecurityGroups?.[0],
  );

  getSecurityGroups = paginateBuilder<EC2>(paginateDescribeSecurityGroups, 'SecurityGroups');

  // TODO: Would it ever be possible to macro this?
  async deleteSecurityGroup(client: EC2, instanceParams: DeleteSecurityGroupRequest) {
    try {
      return await client.deleteSecurityGroup(instanceParams);
    } catch (e: any) {
      if (e.Code === 'DependencyViolation') {
        // Just wait for 5 min on every dependency violation and retry
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        try {
          return await client.deleteSecurityGroup(instanceParams);
        } catch (e2: any) {
          // If the dependency continues we add the dependency to the error message in order to
          // debug what is happening
          if (e2.Code === 'DependencyViolation') {
            const sgEniInfo = await client.describeNetworkInterfaces({
              Filters: [
                {
                  Name: 'group-id',
                  Values: [`${instanceParams.GroupId}`],
                },
              ],
            });
            const eniMessage = `Network interfaces associated with security group ${
              instanceParams.GroupId
            }: ${JSON.stringify(sgEniInfo.NetworkInterfaces)}`;
            e2.message = `${e2.message} | ${eniMessage}`;
          }
          throw e2;
        }
      }
      throw e;
    }
  }

  db = new Crud2({
    create: async (e: SecurityGroup[], ctx: Context) => {
      // If a VPC record is associated with this security group that doesn't exist in the DB, we
      // need to create it first or TypeORM will fail
      for (const out of e) {
        if (out.vpc && out.vpc.vpcId && !out.vpc.id) {
          // There may be a race condition/double write happening here, so check if this thing
          // has been created in the meantime
          const dbVpc = await awsVpcModule.vpc.db.read(ctx, out.vpc.vpcId);
          if (!!dbVpc) {
            out.vpc = dbVpc;
          } else {
            await awsVpcModule.vpc.db.create(out.vpc, ctx);
          }
        }
      }
      await ctx.orm.save(SecurityGroup, e);
    },
    read: async (ctx: Context, id?: string) => {
      // TODO: Possible to automate this?
      const relations = ['securityGroupRules', 'securityGroupRules.securityGroup'];
      const opts = id
        ? {
            where: {
              groupId: id,
            },
            relations,
          }
        : { relations };
      const securityGroups = await ctx.orm.find(SecurityGroup, opts);
      for (const sg of securityGroups) {
        if (!sg.vpc) {
          const vpcs: Vpc[] = await awsVpcModule.vpc.db.read(ctx);
          if (!vpcs.length) {
            throw new Error('Vpcs need to be loaded first');
          }
          const defaultVpc = vpcs.find((vpc: Vpc) => vpc.isDefault === true);
          sg.vpc = defaultVpc;
          await ctx.orm.save(SecurityGroup, sg);
          if (sg.groupId) {
            ctx.memo.db.SecurityGroup[sg.groupId] = sg;
          }
        }
      }
      return securityGroups;
    },
    update: async (e: SecurityGroup[], ctx: Context) => {
      // If a VPC record is associated with this security group that doesn't exist in the DB, we
      // need to create it first or TypeORM will fail
      for (const out of e) {
        if (out.vpc && out.vpc.vpcId && !out.vpc.id) {
          // There may be a race condition/double write happening here, so check if this thing
          // has been created in the meantime
          const dbVpc = await awsVpcModule.vpc.db.read(ctx, out.vpc.vpcId);
          if (!!dbVpc) {
            out.vpc = dbVpc;
          } else {
            await awsVpcModule.vpc.db.create(out.vpc, ctx);
          }
        }
      }
      await ctx.orm.save(SecurityGroup, e);
    },
    delete: (e: SecurityGroup[], ctx: Context) => ctx.orm.remove(SecurityGroup, e),
  });

  cloud: Crud2<SecurityGroup> = new Crud2({
    create: (es: SecurityGroup[], ctx: Context) => this.sgCloudCreate(es, ctx, false),
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawSecurityGroup = await this.getSecurityGroup(client.ec2client, id);
        if (!rawSecurityGroup) return;
        return await this.sgMapper(rawSecurityGroup, ctx);
      } else {
        const sgs = await this.getSecurityGroups(client.ec2client);
        const out = [];
        for (const sg of sgs) {
          out.push(await this.sgMapper(sg, ctx));
        }
        return out;
      }
    },
    updateOrReplace: () => 'replace',
    update: async (es: SecurityGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        // Special behavior here. You're not allowed to mess with the "default" SecurityGroup.
        // You can mess with its rules, but not this record itself, so any attempt to update it
        // is instead turned into *restoring* the value in the database to match the cloud value
        if (e.groupName === 'default') {
          // Because updates are based on the `groupId` matching but not some other property,
          // we can be sure that the security group rules for the default security group are
          // properly associated so we don't need to do anything about them here, just restore
          // the other properties
          const cloudRecord = ctx?.memo?.cloud?.SecurityGroup?.[e.groupId ?? ''];
          cloudRecord.id = e.id;
          await this.module.securityGroup.db.update(cloudRecord, ctx);
          ctx.memo.db.SecurityGroup[cloudRecord.groupId] = cloudRecord; // Force the cache
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
            const sg = await this.module.securityGroup.cloud.create(e, ctx);
            if (!sg || sg instanceof Array) continue;
            out.push(sg);
          } catch (_) {
            // We mutate the `GroupName` to something unique and unlikely to collide (we should
            // be too slow to ever collide at a millisecond level). This path doesn't save back
            // to the DB like create does (at least right now, if that changes, we need to
            // rethink this logic here)
            e.groupName = Date.now().toString();
            out.push(...(await this.sgCloudCreate([e], ctx, true)));
          }
        }
      }
      return out;
    },
    delete: async (es: SecurityGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        // Special behavior here. You're not allowed to mess with the "default" SecurityGroup while the VPC is active.
        // You can mess with its rules, but not this record itself, so any attempt to update it
        // is instead turned into *restoring* the value in the database to match the cloud value
        // Check if there is a VPC for this security group in the database
        const vpcDbRecord = Object.values(ctx?.memo?.db?.Vpc ?? {}).find(
          (a: any) => a.vpcId === e.vpc?.vpcId,
        );
        if (e.groupName === 'default' && !!vpcDbRecord) {
          // If there is a security group in the database with the 'default' groupName but we
          // are still hitting the 'delete' path, that's a race condition and we should just do
          // nothing here.
          const dbRecord = Object.values(ctx?.memo?.db?.SecurityGroup ?? {}).find(
            (a: any) => a.groupName === 'default' && a.vpc?.vpcId === e.vpc?.vpcId,
          );
          if (!!dbRecord) return;
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          await this.module.securityGroup.db.update(e, ctx);
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.SecurityGroup[e.groupId ?? ''] = e;
          const rules = ctx?.memo?.cloud?.SecurityGroupRule ?? [];
          const relevantRules = rules.filter((r: SecurityGroupRule) => r.securityGroup.groupId === e.groupId);
          if (relevantRules.length > 0) {
            await this.module.securityGroupRule.db.update(relevantRules, ctx);
          }
        } else {
          await this.deleteSecurityGroup(client.ec2client, {
            GroupId: e.groupId,
          });
          // Also need to delete the security group rules associated with this security group,
          // if any
          const rules = await this.module.securityGroupRule.db.read(ctx);
          const relevantRules = rules.filter((r: SecurityGroupRule) => r.securityGroup.groupId === e.groupId);
          await this.module.securityGroupRule.db.delete(relevantRules, ctx);
          // Let's clear the record from the caches here, too?
          ctx.memo.cloud.SecurityGroup = Object.fromEntries(
            Object.entries(ctx.memo.cloud.SecurityGroup).filter(
              ([_, v]) => e.groupId !== (v as SecurityGroup).groupId,
            ),
          );
          ctx.memo.db.SecurityGroup = Object.fromEntries(
            Object.entries(ctx.memo.db.SecurityGroup).filter(
              ([_, v]) => e.groupId !== (v as SecurityGroup).groupId,
            ),
          );
        }
      }
    },
  });

  constructor(module: AwsSecurityGroupModule) {
    super();
    this.module = module;
    super.init();
  }
}

class SecurityGroupRuleMapper extends MapperBase<SecurityGroupRule> {
  module: AwsSecurityGroupModule;
  entity = SecurityGroupRule;
  equals = (a: SecurityGroupRule, b: SecurityGroupRule) => {
    if (a.sourceSecurityGroup != b.sourceSecurityGroup) return false;
    if (a.sourceSecurityGroup) {
      // for source security group we avoid comparison with ip and description (as those are auto-created)
      return (
        Object.is(a.isEgress, b.isEgress) &&
        Object.is(a.prefixListId, b.prefixListId) &&
        Object.is(a.ipProtocol, b.ipProtocol)
      );
    } else {
      return (
        Object.is(a.isEgress, b.isEgress) &&
        Object.is(a.ipProtocol, b.ipProtocol) &&
        Object.is(a.fromPort, b.fromPort) &&
        Object.is(a.toPort, b.toPort) &&
        Object.is(a.cidrIpv4, b.cidrIpv4) &&
        Object.is(a.cidrIpv6, b.cidrIpv6) &&
        Object.is(a.prefixListId, b.prefixListId) &&
        Object.is(a.description, b.description)
      );
    }
  };

  async sgrMapper(sgr: AwsSecurityGroupRule, ctx: Context) {
    const client = (await ctx.getAwsClient()) as AWS;

    const out = new SecurityGroupRule();
    out.securityGroupRuleId = sgr?.SecurityGroupRuleId;
    out.securityGroup = await this.module.securityGroup.cloud.read(ctx, sgr?.GroupId);
    out.isEgress = sgr?.IsEgress ?? false;

    if (sgr.ReferencedGroupInfo) {
      // retrieve group details
      const group = await this.module.securityGroup.getSecurityGroup(
        client.ec2client,
        sgr.ReferencedGroupInfo.GroupId,
      );
      if (group) out.sourceSecurityGroup = group.GroupName;
    } else {
      out.fromPort = sgr?.FromPort;
      out.toPort = sgr?.ToPort;
      out.cidrIpv4 = sgr?.CidrIpv4;
      out.cidrIpv6 = sgr?.CidrIpv6;
    }
    out.ipProtocol = sgr?.IpProtocol ?? '';
    out.prefixListId = sgr?.PrefixListId;
    out.description = sgr?.Description;

    return out;
  }

  createSecurityGroupEgressRules = async (client: EC2, rules: AuthorizeSecurityGroupEgressCommandInput[]) =>
    mapLin(rules, client.authorizeSecurityGroupEgress.bind(client));
  createSecurityGroupIngressRules = async (client: EC2, rules: AuthorizeSecurityGroupIngressCommandInput[]) =>
    mapLin(rules, client.authorizeSecurityGroupIngress.bind(client));
  getSecurityGroupRule = crudBuilderFormat<
    EC2,
    'describeSecurityGroupRules',
    AwsSecurityGroupRule | undefined
  >(
    'describeSecurityGroupRules',
    id => ({ SecurityGroupRuleIds: [id] }),
    res => res?.SecurityGroupRules?.[0],
  );
  getSecurityGroupRules = paginateBuilder<EC2>(paginateDescribeSecurityGroupRules, 'SecurityGroupRules');
  deleteSecurityGroupEgressRules = async (client: EC2, rules: RevokeSecurityGroupEgressCommandInput[]) =>
    mapLin(rules, client.revokeSecurityGroupEgress.bind(client));
  deleteSecurityGroupIngressRules = async (client: EC2, rules: RevokeSecurityGroupIngressCommandInput[]) =>
    mapLin(rules, client.revokeSecurityGroupIngress.bind(client));

  db = new Crud2({
    create: (e: SecurityGroupRule[], ctx: Context) => ctx.orm.save(SecurityGroupRule, e),
    read: async (ctx: Context, id?: string) => {
      // TODO: Possible to automate this?
      const relations = ['securityGroup', 'securityGroup.securityGroupRules'];
      const opts = id
        ? {
            where: {
              securityGroupRuleId: id,
            },
            relations,
          }
        : { relations };
      return await ctx.orm.find(SecurityGroupRule, opts);
    },
    update: (e: SecurityGroupRule[], ctx: Context) => ctx.orm.save(SecurityGroupRule, e),
    delete: (e: SecurityGroupRule[], ctx: Context) => ctx.orm.remove(SecurityGroupRule, e),
  });

  cloud = new Crud2({
    create: async (es: SecurityGroupRule[], ctx: Context) => {
      // TODO: While the API supports creating multiple security group rules simultaneously,
      // I can't figure out a 100% correct way to identify which created rules are associated
      // with which returned ID to store in the database, so we're doing these sequentially at
      // the moment.
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const en of es) {
        const GroupId = en?.securityGroup?.groupId;
        if (!GroupId)
          throw new Error('Cannot create a security group rule for a security group that does not yet exist');

        // if there is no protocol and no security group, fail
        if (!en.ipProtocol && !en.sourceSecurityGroup) {
          throw new Error(
            'Cannot create a security group rule without either ip protocol or source security group',
          );
        }

        // get details for security group if we have
        let groupName: string | undefined = undefined;
        let groupId: string | undefined = undefined;
        let newRule: IpPermission | undefined = undefined;

        if (en.sourceSecurityGroup) {
          if (en.securityGroup.vpc?.isDefault) {
            // we just specify group name
            groupName = en.sourceSecurityGroup;
          } else {
            // get data for this security group
            const group = await this.module.securityGroup.getSecurityGroupByName(
              client.ec2client,
              en.sourceSecurityGroup,
            );
            if (!group) throw new Error('Security group rule has no group associated');
            if (group.GroupName) groupName = group.GroupName;
            if (group.GroupId) groupId = group.GroupId;
          }
        } else {
          // The rest of these should be defined if present
          newRule = {};
          if (en.cidrIpv4) newRule.IpRanges = [{ CidrIp: en.cidrIpv4 }];
          if (en.cidrIpv6) newRule.Ipv6Ranges = [{ CidrIpv6: en.cidrIpv6 }];
          if (en.description) {
            if (newRule.IpRanges) {
              if (en.cidrIpv4) newRule.IpRanges[0].Description = en.description;
            }
            if (newRule.Ipv6Ranges) {
              if (en.cidrIpv6) newRule.Ipv6Ranges[0].Description = en.description;
            }
          }
          if (en.fromPort) newRule.FromPort = en.fromPort;
          if (en.ipProtocol) newRule.IpProtocol = en.ipProtocol;

          if (en.prefixListId) newRule.PrefixListIds = [en.prefixListId as PrefixListId];
          // TODO: There's something weird about `ReferencedGroupId` that I need to dig into
          if (en.toPort) newRule.ToPort = en.toPort;
        }

        let res;
        if (en.isEgress) {
          const input: AuthorizeSecurityGroupEgressCommandInput = {
            GroupId,
          };
          if (newRule) input.IpPermissions = [newRule];
          if (groupName) input.SourceSecurityGroupName = groupName;
          if (groupId) input.SourceSecurityGroupOwnerId = groupId;
          res = (await this.createSecurityGroupEgressRules(client.ec2client, [input]))[0];
        } else {
          const input: AuthorizeSecurityGroupIngressCommandInput = {
            GroupId,
          };
          if (newRule) input.IpPermissions = [newRule];
          if (groupName) input.SourceSecurityGroupName = groupName;
          if (groupId) input.SourceSecurityGroupOwnerId = groupId;
          res = (await this.createSecurityGroupIngressRules(client.ec2client, [input]))[0];
        }
        // Now to either throw on error or save the cloud-generated fields
        if (res.Return !== true || res.SecurityGroupRules?.length === 0) {
          throw new Error(`Unable to create security group rule`);
        }

        if (!en.ipProtocol && en.sourceSecurityGroup) {
          if (res.SecurityGroupRules.length > 0) {
            // it will generate 3 rules - we need to delete the current one and replace by the 3 expanded ones
            for (const rule of res.SecurityGroupRules) {
              const e = await this.sgrMapper(rule, ctx);
              if (e) {
                e.securityGroup = en.securityGroup;
                e.description = en.description;
                e.isEgress = en.isEgress;
                await this.db.create([e], ctx);
                out.push(e);
              }
            }

            // delete the previously created, not expanded, rule
            await this.db.delete([en], ctx);
          }
        } else {
          en.securityGroupRuleId = res.SecurityGroupRules?.[0].SecurityGroupRuleId;
          out.push(en);
          await this.module.securityGroupRule.db.update(en, ctx);
        }
        return out;
      }
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawSecurityGroupRule = await this.getSecurityGroupRule(client.ec2client, id);
        if (!rawSecurityGroupRule) return;
        return await this.sgrMapper(rawSecurityGroupRule, ctx);
      } else {
        const sgrs = await this.getSecurityGroupRules(client.ec2client);
        const out = [];
        for (const sgr of sgrs) {
          out.push(await this.sgrMapper(sgr, ctx));
        }
        return out;
      }
    },
    // TODO: Edit rules when possible in the future
    updateOrReplace: () => 'replace',
    update: async (es: SecurityGroupRule[], ctx: Context) => {
      // First we create new instances of these records, then we delete the old instances
      // To make sure we don't accidentally delete the wrong things, we clone these entities
      const deleteEs = es.map(e => ({ ...e }));
      await this.module.securityGroupRule.cloud.create(es, ctx);
      await this.module.securityGroupRule.cloud.delete(deleteEs, ctx);
    },
    delete: async (es: SecurityGroupRule[], ctx: Context) => {
      const egressDeletesToRun: any = {};
      const ingressDeletesToRun: any = {};
      for (const en of es) {
        const GroupId = en?.securityGroup?.groupId;
        if (!GroupId)
          throw new Error('Cannot create a security group rule for a security group that does not yet exist');
        if (en.isEgress) {
          egressDeletesToRun[GroupId] = egressDeletesToRun[GroupId] ?? [];
          egressDeletesToRun[GroupId].push(en.securityGroupRuleId);
        } else {
          ingressDeletesToRun[GroupId] = ingressDeletesToRun[GroupId] ?? [];
          ingressDeletesToRun[GroupId].push(en.securityGroupRuleId);
        }
      }

      const client = (await ctx.getAwsClient()) as AWS;
      for (const GroupId of Object.keys(egressDeletesToRun)) {
        try {
          const res = (
            await this.deleteSecurityGroupEgressRules(client.ec2client, [
              {
                GroupId,
                SecurityGroupRuleIds: egressDeletesToRun[GroupId],
              },
            ])
          )[0];
          if (res.Return !== true) {
            throw new Error(`Failed to remove the security group rules ${res}`);
          }
        } catch (e: any) {
          if (e.Code === 'InvalidGroup.NotFound') {
            logger.info('Security Group have been deleted');
          } else {
            throw e;
          }
        }
      }
      for (const GroupId of Object.keys(ingressDeletesToRun)) {
        try {
          const res = (
            await this.deleteSecurityGroupIngressRules(client.ec2client, [
              {
                GroupId,
                SecurityGroupRuleIds: ingressDeletesToRun[GroupId],
              },
            ])
          )[0];
          if (res.Return !== true) {
            throw new Error(`Failed to remove the security group rules ${res}`);
          }
        } catch (e: any) {
          if (e.Code === 'InvalidGroup.NotFound') {
            logger.info('Security Group have been deleted');
          } else {
            throw e;
          }
        }
      }
      // Let's just clear the record from both caches on a delete
      ctx.memo.cloud.SecurityGroupRule = ctx?.memo?.cloud?.SecurityGroupRule
        ? Object.fromEntries(
            Object.entries(ctx.memo.cloud.SecurityGroupRule).filter(
              ([_, v]) =>
                !es.map(e => e.securityGroupRuleId).includes((v as SecurityGroupRule).securityGroupRuleId),
            ),
          )
        : {};
      ctx.memo.db.SecurityGroupRule = ctx?.memo?.db?.SecurityGroupRule
        ? Object.fromEntries(
            Object.entries(ctx.memo.db.SecurityGroupRule).filter(
              ([_, v]) =>
                !es.map(e => e.securityGroupRuleId).includes((v as SecurityGroupRule).securityGroupRuleId),
            ),
          )
        : {};
    },
  });

  constructor(module: AwsSecurityGroupModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsSecurityGroupModule extends ModuleBase {
  securityGroup: SecurityGroupMapper;
  securityGroupRule: SecurityGroupRuleMapper;

  constructor() {
    super();
    this.securityGroup = new SecurityGroupMapper(this);
    this.securityGroupRule = new SecurityGroupRuleMapper(this);
    super.init();
  }
}
export const awsSecurityGroupModule = new AwsSecurityGroupModule();
