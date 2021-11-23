import { In, } from 'typeorm'
import { Action, Listener, LoadBalancer, } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../../services/gateways/aws'
import {
  ActionTypeEnum,
  AwsAction,
  AwsListener,
  AwsLoadBalancer,
  AwsTargetGroup,
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerStateEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  ProtocolVersionEnum,
  TargetGroupIpAddressTypeEnum,
  TargetTypeEnum,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsElb1637666608609, } from './migration/1637666608609-aws_elb'
import { AwsAccount, AwsSecurityGroupModule } from '..'
import { AvailabilityZone, AwsSubnet } from '../aws_account/entity'
import { DepError } from '../../services/lazy-dep'

export const AwsElbModule: Module = new Module({
  name: 'aws_elb',
  dependencies: ['aws_account', 'aws_security_group',],
  provides: {
    entities: allEntities,
    tables: ['aws_target_group', 'aws_load_balancer', 'aws_listener', 'aws_action',],
    functions: ['create_aws_listener', 'create_aws_target_group', 'create_aws_load_balancer',],
  },
  utils: {
    actionMapper: async (a: Action, ctx: Context) => {
      const out = new AwsAction();
      if (!a?.Type || !a?.TargetGroupArn) {
        throw new Error('Listerner action not defined properly');
      }
      out.actionType = (a.Type as ActionTypeEnum);
      out.targetGroup = ctx.memo?.db?.TargetGroup?.[a?.TargetGroupArn] ?? await AwsElbModule.mappers.targetGroup.db.read(ctx, a.TargetGroupArn);
      return out;
    },
    listenerMapper: async (l: Listener, ctx: Context) => {
      const out = new AwsListener();
      if (!l?.LoadBalancerArn || !l?.Port) {
        throw new Error('Listerner not defined properly');
      }
      out.listenerArn = l?.ListenerArn;
      out.loadBalancer = ctx.memo?.db?.AwsListener?.[l.LoadBalancerArn] ?? await AwsElbModule.mappers.loadBalancer.db.read(ctx, l?.LoadBalancerArn);
      out.port = l?.Port;
      out.protocol = l?.Protocol as ProtocolEnum;
      out.defaultActions = await Promise.all(l.DefaultActions?.map(async a => {
        const dbAct = await ctx.orm.findOne(AwsAction, {
          where: {
            targetGroup: { targetGroupArn: a.TargetGroupArn },
          },
          relations: ['targetGroup'],
        });
        if (!dbAct) return AwsElbModule.utils.actionMapper(a, ctx);
        return dbAct;
      }) ?? []);
      return out;
    },
    loadBalancerMapper: async (lb: LoadBalancer, ctx: Context) => {
      const out = new AwsLoadBalancer();
      if (!lb?.LoadBalancerName || !lb?.Scheme || !lb?.Type || !lb?.IpAddressType || !lb.VpcId) {
        throw new Error('Load balancer not defined properly');
      }
      out.loadBalancerName = lb.LoadBalancerName;
      out.loadBalancerArn = lb.LoadBalancerArn;
      out.dnsName = lb.DNSName;
      out.canonicalHostedZoneId = lb.CanonicalHostedZoneId;
      out.createdTime = lb.CreatedTime ? new Date(lb.CreatedTime) : lb.CreatedTime;
      out.scheme = lb.Scheme as LoadBalancerSchemeEnum;
      out.state = lb.State?.Code as LoadBalancerStateEnum;
      out.loadBalancerType = lb.Type as LoadBalancerTypeEnum;
      out.securityGroups = await Promise.all(lb.SecurityGroups?.map(sg => ctx.memo?.db?.AwsSecurityGroup?.sg ?? AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg)) ?? []);
      out.ipAddressType = lb.IpAddressType as IpAddressType;
      out.customerOwnedIpv4Pool = lb.CustomerOwnedIpv4Pool;
      out.vpc = ctx.memo?.db?.AwsVpc?.[lb.VpcId] ?? await AwsAccount.mappers.vpc.db.read(ctx, lb.VpcId);
      const availabilityZones = ctx.memo?.db?.AvailabilityZone ? Object.values(ctx.memo?.db?.AvailabilityZone) : await AwsAccount.mappers.availabilityZone.db.read(ctx);
      out.availabilityZones = lb.AvailabilityZones?.map(az => availabilityZones.find((z: any) => z.zoneName === az.ZoneName!) as AvailabilityZone);
      const subnets = ctx.memo?.db?.AwsSubnet ? Object.values(ctx.memo?.db?.AwsSubnet) : await AwsAccount.mappers.subnet.db.read(ctx);
      out.subnets = lb.AvailabilityZones?.map(az => subnets.find((sn: AwsSubnet) => sn.subnetId === az.SubnetId));
      return out;
    },
    targetGroupMapper: async (tg: any, ctx: Context) => {
      const out = new AwsTargetGroup();
      if (!tg?.TargetGroupName) {
        throw new Error('Target group not defined properly');
      }
      out.targetGroupName = tg.TargetGroupName;
      out.targetType = tg.TargetType as TargetTypeEnum;
      out.targetGroupArn = tg.TargetGroupArn ?? null;
      out.ipAddressType = tg.IpAddressType as TargetGroupIpAddressTypeEnum ?? null;
      out.protocol = tg.Protocol as ProtocolEnum ?? null;
      out.port = tg.Port ?? null;
      out.healthCheckProtocol = tg.HealthCheckProtocol as ProtocolEnum ?? null;
      out.healthCheckPort = tg.HealthCheckPort ?? null;
      out.healthCheckEnabled = tg.HealthCheckEnabled ?? null;
      out.healthCheckIntervalSeconds = tg.HealthCheckIntervalSeconds ?? null;
      out.healthCheckTimeoutSeconds = tg.healthCheckTimeoutSeconds ?? null;
      out.healthyThresholdCount = tg.HealthyThresholdCount ?? null;
      out.unhealthyThresholdCount = tg.UnhealthyThresholdCount ?? null;
      out.healthCheckPath = tg.HealthCheckPath ?? null;
      out.protocolVersion = tg.ProtocolVersion as ProtocolVersionEnum ?? null;
      out.vpc = ctx.memo?.db?.AwsVpc?.[tg.VpcId] ?? await AwsAccount.mappers.vpc.db.read(ctx, tg.VpcId);
      return out;
    },
  },
  mappers: {
    listener: new Mapper<AwsListener>({
      entity: AwsListener,
      entityId: (e: AwsListener) => e?.listenerArn ?? '',
      equals: (a: AwsListener, b: AwsListener) => Object.is(a.listenerArn, b.listenerArn)
        && Object.is(a.port, b.port)
        && Object.is(a.protocol, b.protocol),
      source: 'db',
      db: new Crud({
        create: async (l: AwsListener | AwsListener[], ctx: Context) => {
          const es = Array.isArray(l) ? l : [l];
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new DepError('Error retrieving generated column');
              e.loadBalancer.id = lb.id;
            }
            for (const da of e.defaultActions ?? []) {
              if (!da.id) {
                const a = await ctx.orm.findOne(AwsAction, {
                  where: {
                    targetGroup: { targetGroupArn: da.targetGroup.targetGroupArn },
                  },
                  relations: ['targetGroup'],
                });
                if (a?.id) {
                  da.id = a.id;
                }
              }
            }
          }
          await ctx.orm.save(AwsListener, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ["loadBalancer"];
          const opts = id ? {
            where: {
              listenerArn: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(AwsListener, opts) : await ctx.orm.findOne(AwsListener, opts);
        },
        update: async (l: AwsListener | AwsListener[], ctx: Context) => {
          const es = Array.isArray(l) ? l : [l];
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new DepError('Error retrieving generated column');
              e.loadBalancer.id = lb.id;
            }
            for (const da of e.defaultActions ?? []) {
              if (!da.id) {
                const a = await ctx.orm.findOne(AwsAction, {
                  where: {
                    targetGroup: { targetGroupArn: da.targetGroup.targetGroupArn },
                  },
                  relations: ['targetGroup'],
                });
                if (!a.id) throw new DepError('Error retrieving generated column');
                da.id = a.id;
              }
            }
          }
          await ctx.orm.save(AwsListener, es);
        },
        delete: async (e: AwsListener | AwsListener[], ctx: Context) => { await ctx.orm.remove(AwsListener, e); },
      }),
      cloud: new Crud({
        create: async (l: AwsListener | AwsListener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(l) ? l : [l];
          const out = await Promise.all(es.map(async (e) => {
            const result = await client.createListener({
              Port: e.port,
              Protocol: e.protocol,
              LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
              DefaultActions: e.defaultActions?.map(a => ({ Type: a.actionType, TargetGroupArn: a.targetGroup.targetGroupArn })),
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('ListenerArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getListener(result.ListenerArn ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsElbModule.utils.listenerMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsElbModule.mappers.listener.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(l)) {
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
                return await AwsElbModule.utils.listenerMapper(
                  await client.getListener(id), ctx
                );
              }));
            } else {
              return await AwsElbModule.utils.listenerMapper(
                await client.getListener(ids), ctx
              );
            }
          } else {
            const loadBalancers = ctx.memo?.cloud?.AwsLoadBalancer ? Object.values(ctx.memo?.cloud?.AwsLoadBalancer) : await AwsElbModule.mappers.loadBalancer.cloud.read(ctx);
            const loadBalancerArns = loadBalancers.map((lb: any) => lb.loadBalancerArn);
            const result = await client.getListeners(loadBalancerArns);
            return await Promise.all(result.Listeners.map(async (l: any) => {
              return await AwsElbModule.utils.listenerMapper(l, ctx);
            }));
          }
        },
        update: async (_l: AwsListener | AwsListener[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (l: AwsListener | AwsListener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(l) ? l : [l];
          await Promise.all(es.map(e => client.deleteListener(e.listenerArn!)));
        },
      }),
    }),
    loadBalancer: new Mapper<AwsLoadBalancer>({
      entity: AwsLoadBalancer,
      entityId: (e: AwsLoadBalancer) => e?.loadBalancerArn ?? '',
      equals: (_a: AwsLoadBalancer, _b: AwsLoadBalancer) => true, //  Do not let load balancer updates
      source: 'db',
      db: new Crud({
        create: async (lb: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => {
          const es = Array.isArray(lb) ? lb : [lb];
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                sg.id = g.id;
              }
            }
            for (const sn of e.subnets ?? []) {
              if (!sn.id) {
                const s = await AwsAccount.mappers.subnet.db.read(ctx, sn.subnetId);
                sn.id = s.id;
              }
            }
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              e.vpc.id = v.id;
            }
            for (const az of e.availabilityZones ?? []) {
              if (!az.id) {
                const availabilityZones = ctx.memo?.db?.AvailabilityZone ? Object.values(ctx.memo?.db?.AvailabilityZone) : await AwsAccount.mappers.availabilityZone.db.read(ctx);
                const z = availabilityZones.find((a: any) => a.zoneName === az.zoneName);
                az.id = z.id;
              }
            }
          }
          await ctx.orm.save(AwsLoadBalancer, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['securityGroups', 'availabilityZones', 'subnets', 'vpc'];
          const opts = id ? {
            where: {
              loadBalancerArn: Array.isArray(id) ? In(id) : id,
            },
            relations
          } : { relations };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(AwsLoadBalancer, opts) : await ctx.orm.findOne(AwsLoadBalancer, opts);
        },
        update: async (lb: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => {
          const es = Array.isArray(lb) ? lb : [lb];
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                if (!g.id) throw new DepError('Error retrieving generated column');
                sg.id = g.id;
              }
            }
            for (const sn of e.subnets ?? []) {
              if (!sn.id) {
                const s = await AwsAccount.mappers.subnet.db.read(ctx, sn.subnetId);
                if (!s.id) throw new DepError('Error retrieving generated column');
                sn.id = s.id;
              }
            }
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new DepError('Error retrieving generated column');
              e.vpc.id = v.id;
            }
            for (const az of e.availabilityZones ?? []) {
              if (!az.id) {
                const availabilityZones = ctx.memo?.db?.AvailabilityZone ? Object.values(ctx.memo?.db?.AvailabilityZone) : await AwsAccount.mappers.availabilityZone.db.read(ctx);
                const z = availabilityZones.find((a: any) => a.zoneName === az.zoneName);
                if (!z.id) throw new DepError('Error retrieving generated column');
                az.id = z.id;
              }
            }
          }
          await ctx.orm.save(AwsLoadBalancer, es);
        },
        delete: async (e: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => { await ctx.orm.remove(AwsLoadBalancer, e); },
      }),
      cloud: new Crud({
        create: async (lb: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lb) ? lb : [lb];
          const out = await Promise.all(es.map(async (e) => {
            const result = await client.createLoadBalancer({
              Name: e.loadBalancerName,
              Subnets: e.subnets?.map(sn => sn.subnetId!),
              SecurityGroups: e.securityGroups?.map(sg => sg.groupId!),
              Scheme: e.scheme,
              Type: e.loadBalancerType,
              IpAddressType: e.ipAddressType,
              CustomerOwnedIpv4Pool: e.customerOwnedIpv4Pool,
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('LoadBalancerArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getLoadBalancer(result.LoadBalancerArn ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsElbModule.utils.loadBalancerMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsElbModule.mappers.loadBalancer.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(lb)) {
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
                return await AwsElbModule.utils.loadBalancerMapper(
                  await client.getLoadBalancer(id), ctx
                );
              }));
            } else {
              return await AwsElbModule.utils.loadBalancerMapper(
                await client.getLoadBalancer(ids), ctx
              );
            }
          } else {
            const result = await client.getLoadBalancers();
            return await Promise.all(result.LoadBalancers.map((lb: any) => AwsElbModule.utils.loadBalancerMapper(lb, ctx)));
          }
        },
        update: async (_lb: AwsLoadBalancer | AwsLoadBalancer[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (lb: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lb) ? lb : [lb];
          await Promise.all(es.map(e => client.deleteLoadBalancer(e.loadBalancerArn!)));
        },
      }),
    }),
    targetGroup: new Mapper<AwsTargetGroup>({
      entity: AwsTargetGroup,
      entityId: (e: AwsTargetGroup) => e?.targetGroupArn ?? '',
      equals: (a: AwsTargetGroup, b: AwsTargetGroup) => Object.is(a.targetGroupArn, b.targetGroupArn)
        && Object.is(a.healthCheckProtocol, b.healthCheckProtocol)
        && Object.is(a.healthCheckPort, b.healthCheckPort)
        && Object.is(a.healthCheckPath, b.healthCheckPath)
        && Object.is(a.healthCheckEnabled, b.healthCheckEnabled)
        && Object.is(a.healthCheckIntervalSeconds, b.healthCheckIntervalSeconds)
        && Object.is(a.healthCheckTimeoutSeconds, b.healthCheckTimeoutSeconds)
        && Object.is(a.healthyThresholdCount, b.healthyThresholdCount)
        && Object.is(a.unhealthyThresholdCount, b.unhealthyThresholdCount),
      source: 'db',
      db: new Crud({
        create: async (tg: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => {
          const es = Array.isArray(tg) ? tg : [tg];
          for (const e of es) {
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new DepError('Error retrieving generated column')
              e.vpc.id = v.id;
            }
          }
          await ctx.orm.save(AwsTargetGroup, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['vpc'];
          const opts = id ? {
            where: {
              targetGroupArn: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(AwsTargetGroup, opts) : await ctx.orm.findOne(AwsTargetGroup, opts);
        },
        update: async (tg: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => {
          const es = Array.isArray(tg) ? tg : [tg];
          for (const e of es) {
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new DepError('Error retrieving generated column')
              e.vpc.id = v.id;
            }
          }
          await ctx.orm.save(AwsTargetGroup, es);
        },
        delete: async (e: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => { await ctx.orm.remove(AwsTargetGroup, e); },
      }),
      cloud: new Crud({
        create: async (tg: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(tg) ? tg : [tg];
          const out = await Promise.all(es.map(async (e) => {
            const result = await client.createTargetGroup({
              Name: e.targetGroupName,
              TargetType: e.targetType,
              Port: e.port,
              VpcId: e.vpc?.vpcId,
              Protocol: e.protocol,
              ProtocolVersion: e.protocolVersion,
              IpAddressType: e.ipAddressType,
              HealthCheckProtocol: e.healthCheckProtocol,
              HealthCheckPort: e.healthCheckPort,
              HealthCheckPath: e.healthCheckPath,
              HealthCheckEnabled: e.healthCheckEnabled,
              HealthCheckIntervalSeconds: e.healthCheckIntervalSeconds,
              HealthCheckTimeoutSeconds: e.healthCheckTimeoutSeconds,
              HealthyThresholdCount: e.healthyThresholdCount,
              UnhealthyThresholdCount: e.unhealthyThresholdCount,
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('TargetGroupArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getTargetGroup(result.TargetGroupArn ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsElbModule.utils.targetGroupMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsElbModule.mappers.targetGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(tg)) {
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
                return await AwsElbModule.utils.targetGroupMapper(
                  await client.getTargetGroup(id), ctx
                );
              }));
            } else {
              return await AwsElbModule.utils.targetGroupMapper(
                await client.getTargetGroup(ids), ctx
              );
            }
          } else {
            const result = await client.getTargetGroups();
            return await Promise.all(result.TargetGroups.map((tg: any) => AwsElbModule.utils.targetGroupMapper(tg, ctx)));
          }
        },
        update: async (tg: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(tg) ? tg : [tg];
          return await Promise.all(es.map(async (e) => {
            const updatedTargetGroup = await client.updateTargetGroup({
              TargetGroupArn: e.targetGroupArn,
              HealthCheckProtocol: e.healthCheckProtocol,
              HealthCheckPort: e.healthCheckPort,
              HealthCheckPath: e.healthCheckPath,
              HealthCheckEnabled: e.healthCheckEnabled,
              HealthCheckIntervalSeconds: e.healthCheckIntervalSeconds,
              HealthCheckTimeoutSeconds: e.healthCheckTimeoutSeconds,
              HealthyThresholdCount: e.healthyThresholdCount,
              UnhealthyThresholdCount: e.unhealthyThresholdCount,
            });
            return AwsElbModule.utils.targetGroupMapper(updatedTargetGroup, ctx);
          }));
        },
        delete: async (tg: AwsTargetGroup | AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(tg) ? tg : [tg];
          await Promise.all(es.map(e => client.deleteTargetGroup(e.targetGroupArn!)));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsElb1637666608609.prototype.up,
    preremove: awsElb1637666608609.prototype.down,
  },
});
