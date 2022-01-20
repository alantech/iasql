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
import { AwsSecurityGroup } from '../aws_security_group/entity'

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
        throw new Error('Listener\'s default action not defined properly');
      }
      out.actionType = (a.Type as ActionTypeEnum);
      const targetGroups = ctx.memo?.db?.TargetGroup ? Object.values(ctx.memo?.db?.TargetGroup) : await AwsElbModule.mappers.targetGroup.db.read(ctx);
      const targetGroup = targetGroups?.find((tg: any) => tg.targetGroupArn === a?.TargetGroupArn);
      if (!targetGroup) throw new Error('Target groups need to be loaded first');
      out.targetGroup = targetGroup;
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
      const securityGroups = ctx.memo?.db?.AwsSecurityGroup ? Object.values(ctx.memo?.db?.AwsSecurityGroup) : await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx);
      out.securityGroups = lb.SecurityGroups?.map((sg: string) => {
        const r = securityGroups.find((g: any) => g.groupId === sg) as AwsSecurityGroup;
        if (!r) throw new Error('Security groups need to be loaded');
        return r;
      });
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
      out.healthCheckTimeoutSeconds = tg.HealthCheckTimeoutSeconds ?? null;
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
      entityPrint: (e: AwsListener) => ({
        id: e?.id?.toString() ?? '',
        listenerArn: e?.listenerArn ?? '',
        loadBalancer: e?.loadBalancer?.loadBalancerName ?? '',
        port: e?.port?.toString() ?? '',
        protocol: e?.protocol ?? ProtocolEnum.HTTPS, // TODO: Which?
        defaultActions: e?.defaultActions?.map(da => da.actionType).join(', ') ?? '',
      }),
      equals: (a: AwsListener, b: AwsListener) => Object.is(a.listenerArn, b.listenerArn)
        && Object.is(a.port, b.port)
        && Object.is(a.protocol, b.protocol),
      source: 'db',
      db: new Crud({
        create: async (es: AwsListener[], ctx: Context) => {
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new Error('Error retrieving generated column');
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
        read: async (ctx: Context, ids?: string[]) => {
          const relations = ['loadBalancer', 'defaultActions', 'defaultActions.targetGroup'];
          const opts = ids ? {
            where: {
              listenerArn: In(ids),
            },
            relations,
          } : { relations };
          return await ctx.orm.find(AwsListener, opts);
        },
        update: async (es: AwsListener[], ctx: Context) => {
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new Error('Error retrieving generated column');
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
                if (!a.id) throw new Error('Error retrieving generated column');
                da.id = a.id;
              }
            }
          }
          await ctx.orm.save(AwsListener, es);
        },
        delete: (e: AwsListener[], ctx: Context) => ctx.orm.remove(AwsListener, e),
      }),
      cloud: new Crud({
        create: async (es: AwsListener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
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
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const listeners = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getListener(id))) :
            await (async () => {
              // TODO: Should this behavior be standard?
              const loadBalancers = ctx.memo?.cloud?.AwsLoadBalancer ?
                Object.values(ctx.memo?.cloud?.AwsLoadBalancer) :
                await AwsElbModule.mappers.loadBalancer.cloud.read(ctx);
              const loadBalancerArns = loadBalancers.map((lb: any) => lb.loadBalancerArn);
              return (await client.getListeners(loadBalancerArns)).Listeners;
            })();
          return await Promise.all(listeners.map(l => AwsElbModule.utils.listenerMapper(l, ctx)));
        },
        update: async (_l: AwsListener[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (es: AwsListener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(e => client.deleteListener(e.listenerArn!)));
        },
      }),
    }),
    loadBalancer: new Mapper<AwsLoadBalancer>({
      entity: AwsLoadBalancer,
      entityId: (e: AwsLoadBalancer) => e?.loadBalancerArn ?? '',
      entityPrint: (e: AwsLoadBalancer) => ({
        id: e?.id?.toString() ?? '',
        loadBalancerName: e?.loadBalancerName ?? '',
        loadBalancerArn: e?.loadBalancerArn ?? '',
        dnsName: e?.dnsName ?? '',
        canonicalHostedZoneId: e?.canonicalHostedZoneId ?? '',
        createdTime: e?.createdTime?.toISOString() ?? '',
        scheme: e?.scheme ?? LoadBalancerSchemeEnum.INTERNET_FACING, // TODO: Which?
        state: e?.state ?? LoadBalancerStateEnum.ACTIVE, // TODO: Which?
        loadBalancerType: e?.loadBalancerType ?? LoadBalancerTypeEnum.APPLICATION, // TODO: Which?
        vpc: e?.vpc?.vpcId ?? '',
        subnets: e?.subnets?.map(s => s.subnetArn ?? '').join(', ') ?? '',
        availabilityZones: e?.availabilityZones?.map(az => az.zoneName).join(', ') ?? '',
        securityGroups: e?.securityGroups?.map(sg => sg.groupName ?? '').join(', ') ?? '',
        ipAddressType: e?.ipAddressType ?? IpAddressType.DUALSTACK, // TODO: Which?
        customerOwnedIpv4Pool: e?.customerOwnedIpv4Pool ?? '',
      }),
      equals: (_a: AwsLoadBalancer, _b: AwsLoadBalancer) => true, //  Do not let load balancer updates
      source: 'db',
      db: new Crud({
        create: async (es: AwsLoadBalancer[], ctx: Context) => {
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                if (!g?.id) throw new Error('Security groups need to be loaded first');
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
                const availabilityZones = ctx.memo?.db?.AvailabilityZone ?
                  Object.values(ctx.memo?.db?.AvailabilityZone) :
                  await AwsAccount.mappers.availabilityZone.db.read(ctx);
                const z = availabilityZones.find((a: any) => a.zoneName === az.zoneName);
                az.id = z.id;
              }
            }
          }
          await ctx.orm.save(AwsLoadBalancer, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = ['securityGroups', 'availabilityZones', 'subnets', 'vpc'];
          const opts = ids ? {
            where: {
              loadBalancerArn: In(ids),
            },
            relations
          } : { relations };
          return await ctx.orm.find(AwsLoadBalancer, opts);
        },
        update: async (es: AwsLoadBalancer[], ctx: Context) => {
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                if (!g?.id) throw new Error('Security Groups need to be loaded first');
                sg.id = g.id;
              }
            }
            for (const sn of e.subnets ?? []) {
              if (!sn.id) {
                const s = await AwsAccount.mappers.subnet.db.read(ctx, sn.subnetId);
                if (!s.id) throw new Error('Error retrieving generated column');
                sn.id = s.id;
              }
            }
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new Error('Error retrieving generated column');
              e.vpc.id = v.id;
            }
            for (const az of e.availabilityZones ?? []) {
              if (!az.id) {
                const availabilityZones = ctx.memo?.db?.AvailabilityZone ?
                  Object.values(ctx.memo?.db?.AvailabilityZone) :
                  await AwsAccount.mappers.availabilityZone.db.read(ctx);
                const z = availabilityZones.find((a: any) => a.zoneName === az.zoneName);
                if (!z.id) throw new Error('Error retrieving generated column');
                az.id = z.id;
              }
            }
          }
          await ctx.orm.save(AwsLoadBalancer, es);
        },
        delete: (e: AwsLoadBalancer[], ctx: Context) => ctx.orm.remove(AwsLoadBalancer, e),
      }),
      cloud: new Crud({
        create: async (es: AwsLoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const securityGroups = e.securityGroups?.map(sg => {
              if (!sg.groupId) throw new Error('Security group need to be loaded first');
              return sg.groupId;
            });
            const result = await client.createLoadBalancer({
              Name: e.loadBalancerName,
              Subnets: e.subnets?.map(sn => sn.subnetId!),
              SecurityGroups: securityGroups,
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
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const lbs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getLoadBalancer(id))) :
            (await client.getLoadBalancers()).LoadBalancers;
          return await Promise.all(lbs.map(lb => AwsElbModule.utils.loadBalancerMapper(lb, ctx)));
        },
        update: async (_lb: AwsLoadBalancer[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (es: AwsLoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(e => client.deleteLoadBalancer(e.loadBalancerArn!)));
        },
      }),
    }),
    targetGroup: new Mapper<AwsTargetGroup>({
      entity: AwsTargetGroup,
      entityId: (e: AwsTargetGroup) => e?.targetGroupArn ?? '',
      entityPrint: (e: AwsTargetGroup) => ({
        id: e?.id?.toString() ?? '',
        targetGroupName: e?.targetGroupName ?? '',
        targetGroupArn: e?.targetGroupArn ?? '',
        ipAddressType: e?.ipAddressType ?? TargetGroupIpAddressTypeEnum.IPV4, // TODO: Which?
        protocol: e?.protocol ?? ProtocolEnum.HTTPS, // TODO: Which?
        port: e?.port?.toString() ?? '',
        vpc: e?.vpc?.vpcId ?? '',
        healthCheckProtocol: e?.healthCheckProtocol ?? ProtocolEnum.HTTP, // TODO: Which?
        healthCheckPort: e?.healthCheckPort?.toString() ?? '',
        healthCheckEnabled: e?.healthCheckEnabled?.toString() ?? '',
        healthCheckIntervalSeconds: e?.healthCheckIntervalSeconds?.toString() ?? '',
        healthCheckTimeoutSeconds: e?.healthCheckTimeoutSeconds?.toString() ?? '',
        unhealthyThresholdCount: e?.unhealthyThresholdCount?.toString() ?? '',
        healthCheckPath: e?.healthCheckPath ?? '',
        protocolVersion: e?.protocolVersion ?? ProtocolVersionEnum.HTTP1, // TODO: Which?
      }),
      equals: (a: AwsTargetGroup, b: AwsTargetGroup) => Object.is(a.targetGroupArn, b.targetGroupArn)
        && Object.is(a.targetGroupName, b.targetGroupName)
        && Object.is(a.targetType, b.targetType)
        && Object.is(a.ipAddressType, b.ipAddressType)
        && Object.is(a.protocol, b.protocol)
        && Object.is(a.port, b.port)
        && Object.is(a.vpc.id, b.vpc.id)
        && Object.is(a.protocolVersion, b.protocolVersion)
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
        create: async (es: AwsTargetGroup[], ctx: Context) => {
          for (const e of es) {
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new Error('Error retrieving generated column')
              e.vpc.id = v.id;
            }
          }
          await ctx.orm.save(AwsTargetGroup, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = ['vpc'];
          const opts = ids ? {
            where: {
              targetGroupArn: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(AwsTargetGroup, opts);
        },
        update: async (es: AwsTargetGroup[], ctx: Context) => {
          for (const e of es) {
            if (!e.vpc.id) {
              const v = await AwsAccount.mappers.vpc.db.read(ctx, e.vpc.vpcId);
              if (!v.id) throw new Error('Error retrieving generated column')
              e.vpc.id = v.id;
            }
          }
          await ctx.orm.save(AwsTargetGroup, es);
        },
        delete: (e: AwsTargetGroup[], ctx: Context) => ctx.orm.remove(AwsTargetGroup, e),
      }),
      cloud: new Crud({
        create: async (es: AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
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
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const tgs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getTargetGroup(id))) :
            (await client.getTargetGroups()).TargetGroups;
          return await Promise.all(tgs.map(tg => AwsElbModule.utils.targetGroupMapper(tg, ctx)));
        },
        update: async (es: AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
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
        delete: async (es: AwsTargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
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
