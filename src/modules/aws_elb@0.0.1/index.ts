import { In, } from 'typeorm'
import {
  CreateLoadBalancerCommandInput,
  Listener as ListenerAws,
  LoadBalancer as LoadBalancerAws,
} from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../../services/gateways/aws'
import {
  ActionTypeEnum,
  Listener,
  LoadBalancer,
  TargetGroup,
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerStateEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  ProtocolVersionEnum,
  TargetGroupIpAddressTypeEnum,
  TargetTypeEnum,
} from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsSecurityGroupModule } from '..'
import * as metadata from './module.json'

export const AwsElbModule: Module = new Module({
  ...metadata,
  utils: {
    listenerMapper: async (l: ListenerAws, ctx: Context) => {
      const out = new Listener();
      if (!l?.LoadBalancerArn || !l?.Port) {
        throw new Error('Listerner not defined properly');
      }
      out.listenerArn = l?.ListenerArn;
      out.loadBalancer = ctx.memo?.db?.LoadBalancer?.[l.LoadBalancerArn] ?? await AwsElbModule.mappers.loadBalancer.db.read(ctx, l?.LoadBalancerArn);
      out.port = l?.Port;
      out.protocol = l?.Protocol as ProtocolEnum;
      for (const a of l?.DefaultActions ?? []) {
        if (a.Type === ActionTypeEnum.FORWARD) {
          out.actionType = (a.Type as ActionTypeEnum);
          out.targetGroup =  await AwsElbModule.mappers.targetGroup.db.read(ctx, a?.TargetGroupArn) ??
            await AwsElbModule.mappers.targetGroup.cloud.read(ctx, a?.TargetGroupArn);
          if (!out.targetGroup) throw new Error('Target groups need to be loaded first');
        }
      }
      return out;
    },
    loadBalancerMapper: async (lb: LoadBalancerAws, ctx: Context) => {
      const out = new LoadBalancer();
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
      const securityGroups = [];
      const cloudSecurityGroups = lb.SecurityGroups ?? [];
      for (const sg of cloudSecurityGroups) {
        securityGroups.push(await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg) ??
          await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sg));
      }
      if (securityGroups.filter(sg => !!sg).length !== cloudSecurityGroups.length) throw new Error('Security groups need to be loaded first')
      out.securityGroups = securityGroups;
      out.ipAddressType = lb.IpAddressType as IpAddressType;
      out.customerOwnedIpv4Pool = lb.CustomerOwnedIpv4Pool;
      const client = await ctx.getAwsClient() as AWS;
      const vpc = await client.getVpc(lb.VpcId);
      out.vpc = vpc?.IsDefault ? 'default' : lb.VpcId;
      out.availabilityZones = lb.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
      out.subnets = lb.AvailabilityZones?.map(az => az.SubnetId ?? '') ?? [];
      return out;
    },
    targetGroupMapper: async (tg: any, ctx: Context) => {
      const out = new TargetGroup();
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
      const client = await ctx.getAwsClient() as AWS;
      const vpc = await client.getVpc(tg.VpcId);
      out.vpc = vpc?.IsDefault ? 'default' : tg.VpcId;
      return out;
    },
  },
  mappers: {
    listener: new Mapper<Listener>({
      entity: Listener,
      entityPrint: (e: Listener) => ({
        id: e?.id?.toString() ?? '',
        listenerArn: e?.listenerArn ?? '',
        loadBalancer: e?.loadBalancer?.loadBalancerName ?? '',
        port: e?.port?.toString() ?? '',
        protocol: e?.protocol ?? ProtocolEnum.HTTPS, // TODO: Which?
        action: e ? `${e.actionType}: ${e.targetGroup?.targetGroupName}` : '',
      }),
      equals: (a: Listener, b: Listener) => Object.is(a.listenerArn, b.listenerArn)
        && Object.is(a.loadBalancer.loadBalancerArn, b.loadBalancer.loadBalancerArn)
        && Object.is(a.port, b.port)
        && Object.is(a.protocol, b.protocol)
        && Object.is(a.actionType, b.actionType)
        && Object.is(a.targetGroup.targetGroupArn, b.targetGroup.targetGroupArn),
      source: 'db',
      db: new Crud({
        create: async (es: Listener[], ctx: Context) => {
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new Error('Error retrieving generated column');
              e.loadBalancer.id = lb.id;
            }
          }
          await ctx.orm.save(Listener, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          // TODO: Possible to automate this?
          const relations = ['loadBalancer', 'targetGroup'];
          const opts = ids ? {
            where: {
              listenerArn: In(ids),
            },
            relations,
          } : { relations };
          return await ctx.orm.find(Listener, opts);
        },
        update: async (es: Listener[], ctx: Context) => {
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              if (!lb.id) throw new Error('Error retrieving generated column');
              e.loadBalancer.id = lb.id;
            }
          }
          await ctx.orm.save(Listener, es);
        },
        delete: (e: Listener[], ctx: Context) => ctx.orm.remove(Listener, e),
      }),
      cloud: new Crud({
        create: async (es: Listener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const result = await client.createListener({
              Port: e.port,
              Protocol: e.protocol,
              LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
              DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
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
              const loadBalancers = ctx.memo?.cloud?.LoadBalancer ?
                Object.values(ctx.memo?.cloud?.LoadBalancer) :
                await AwsElbModule.mappers.loadBalancer.cloud.read(ctx);
              const loadBalancerArns = loadBalancers.map((lb: any) => lb.loadBalancerArn);
              return (await client.getListeners(loadBalancerArns)).Listeners;
            })();
          return await Promise.all(listeners.map(l => AwsElbModule.utils.listenerMapper(l, ctx)));
        },
        updateOrReplace: (prev: Listener, next: Listener) => {
          if (!Object.is(prev.loadBalancer.loadBalancerArn, next.loadBalancer.loadBalancerArn)) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: Listener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Listener?.[e.listenerArn ?? ''];
            const isUpdate = AwsElbModule.mappers.listener.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              const updatedListener = await client.updateListener({
                ListenerArn: e.listenerArn,
                Port: e.port,
                Protocol: e.protocol,
                DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
              });
              return AwsElbModule.utils.listenerMapper(updatedListener, ctx);
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id in database will be the same `e` will keep it.
              await AwsElbModule.mappers.listener.cloud.delete(cloudRecord, ctx);
              return await AwsElbModule.mappers.listener.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (es: Listener[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(e => client.deleteListener(e.listenerArn!)));
        },
      }),
    }),
    loadBalancer: new Mapper<LoadBalancer>({
      entity: LoadBalancer,
      entityPrint: (e: LoadBalancer) => ({
        id: e?.id?.toString() ?? '',
        loadBalancerName: e?.loadBalancerName ?? '',
        loadBalancerArn: e?.loadBalancerArn ?? '',
        dnsName: e?.dnsName ?? '',
        canonicalHostedZoneId: e?.canonicalHostedZoneId ?? '',
        createdTime: e?.createdTime?.toISOString() ?? '',
        scheme: e?.scheme ?? LoadBalancerSchemeEnum.INTERNET_FACING, // TODO: Which?
        state: e?.state ?? LoadBalancerStateEnum.ACTIVE, // TODO: Which?
        loadBalancerType: e?.loadBalancerType ?? LoadBalancerTypeEnum.APPLICATION, // TODO: Which?
        vpc: e?.vpc ?? '',
        subnets: e?.subnets?.join(', ') ?? '',
        availabilityZones: e?.availabilityZones?.join(', ') ?? '',
        securityGroups: e?.securityGroups?.map(sg => sg.groupName ?? '').join(', ') ?? '',
        ipAddressType: e?.ipAddressType ?? IpAddressType.DUALSTACK, // TODO: Which?
        customerOwnedIpv4Pool: e?.customerOwnedIpv4Pool ?? '',
      }),
      equals: (a: LoadBalancer, b: LoadBalancer) => Object.is(a.availabilityZones?.length, b.availabilityZones?.length)
        && (a.availabilityZones?.filter(aaz => !!aaz).every(aaz => !!b.availabilityZones?.filter(baz => !!baz).find(baz => Object.is(aaz, baz))) ?? false)
        && Object.is(a.canonicalHostedZoneId, b.canonicalHostedZoneId)
        && Object.is(a.createdTime?.getTime(), b.createdTime?.getTime())
        // This property might be comparing null vs undefined
        // tslint:disable-next-line: triple-equals
        && a.customerOwnedIpv4Pool == b.customerOwnedIpv4Pool
        && Object.is(a.dnsName, b.dnsName)
        && Object.is(a.ipAddressType, b.ipAddressType)
        && Object.is(a.loadBalancerName, b.loadBalancerName)
        && Object.is(a.loadBalancerType, b.loadBalancerType)
        && Object.is(a.scheme, b.scheme)
        && Object.is(a.securityGroups?.length, b.securityGroups?.length)
        && (a.securityGroups?.every(asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
        && Object.is(a.state, b.state)
        && Object.is(a.subnets?.length, b.subnets?.length)
        && (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false)
        && Object.is(a.vpc, b.vpc),
      source: 'db',
      db: new Crud({
        create: async (es: LoadBalancer[], ctx: Context) => {
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                if (!g?.id) throw new Error('Security groups need to be loaded first');
                sg.id = g.id;
              }
            }
          }
          await ctx.orm.save(LoadBalancer, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = ['securityGroups'];
          const opts = ids ? {
            where: {
              loadBalancerArn: In(ids),
            },
            relations
          } : { relations };
          return await ctx.orm.find(LoadBalancer, opts);
        },
        update: async (es: LoadBalancer[], ctx: Context) => {
          for (const e of es) {
            for (const sg of e.securityGroups ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                if (!g?.id) throw new Error('Security Groups need to be loaded first');
                sg.id = g.id;
              }
            }
          }
          await ctx.orm.save(LoadBalancer, es);
        },
        delete: (e: LoadBalancer[], ctx: Context) => ctx.orm.remove(LoadBalancer, e),
      }),
      cloud: new Crud({
        create: async (es: LoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const subnets = (await client.getSubnets()).Subnets.map(s => s.SubnetId ?? '');
          return await Promise.all(es.map(async (e) => {
            const securityGroups = e.securityGroups?.map(sg => {
              if (!sg.groupId) throw new Error('Security group need to be loaded first');
              return sg.groupId;
            });
            const input: CreateLoadBalancerCommandInput = {
              Name: e.loadBalancerName,
              Subnets: e.subnets ?? subnets,
              Scheme: e.scheme,
              Type: e.loadBalancerType,
              IpAddressType: e.ipAddressType,
              CustomerOwnedIpv4Pool: e.customerOwnedIpv4Pool,
            };
            if (e.loadBalancerType === LoadBalancerTypeEnum.APPLICATION) {
              input.SecurityGroups = securityGroups;
            }
            const result = await client.createLoadBalancer(input);
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
        updateOrReplace: (prev: LoadBalancer, next: LoadBalancer) => {
          if (
            !(Object.is(prev.loadBalancerName, next.loadBalancerName)
              && Object.is(prev.loadBalancerType, next.loadBalancerType)
              && Object.is(prev.scheme, next.scheme)
              && Object.is(prev.vpc, next.vpc))
          ) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: LoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.LoadBalancer?.[e.loadBalancerArn ?? ''];
            let updatedRecord = { ...cloudRecord };
            const isUpdate = AwsElbModule.mappers.loadBalancer.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              // Update ip address type
              if (!Object.is(cloudRecord.ipAddressType, e.ipAddressType)) {
                const updatedLoadBalancer = await client.updateLoadBalancerIPAddressType({
                  LoadBalancerArn: e.loadBalancerArn,
                  IpAddressType: e.ipAddressType,
                });
                updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
              }
              // Update subnets
              if (!(Object.is(cloudRecord.subnets?.length, e.subnets?.length)
                && (cloudRecord.subnets?.every((csn: any) => !!e.subnets?.find(esn => Object.is(csn, esn))) ?? false))) {
                const updatedLoadBalancer = await client.updateLoadBalancerSubnets({
                  LoadBalancerArn: e.loadBalancerArn,
                  Subnets: e.subnets?.filter(sn => !!sn),
                });
                updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
              }
              // Update security groups
              if (!(Object.is(cloudRecord.securityGroups?.length, e.securityGroups?.length) && (cloudRecord.securityGroups?.every((csg: any) => !!e.securityGroups?.find(esg => Object.is(csg.groupId, esg.groupId))) ?? false))) {
                const updatedLoadBalancer = await client.updateLoadBalancerSecurityGroups({
                  LoadBalancerArn: e.loadBalancerArn,
                  SecurityGroups: e.securityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!),
                });
                updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
              }
              // Restore auto generated values
              updatedRecord.id = e.id;
              await AwsElbModule.mappers.loadBalancer.db.update(updatedRecord, ctx);
              return updatedRecord;
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id will be the same in database since `e` will keep it.
              await AwsElbModule.mappers.loadBalancer.cloud.delete(cloudRecord, ctx);
              return await AwsElbModule.mappers.loadBalancer.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (es: LoadBalancer[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(e => client.deleteLoadBalancer(e.loadBalancerArn!)));
        },
      }),
    }),
    targetGroup: new Mapper<TargetGroup>({
      entity: TargetGroup,
      entityPrint: (e: TargetGroup) => ({
        id: e?.id?.toString() ?? '',
        targetGroupName: e?.targetGroupName ?? '',
        targetGroupArn: e?.targetGroupArn ?? '',
        ipAddressType: e?.ipAddressType ?? TargetGroupIpAddressTypeEnum.IPV4, // TODO: Which?
        protocol: e?.protocol ?? ProtocolEnum.HTTPS, // TODO: Which?
        port: e?.port?.toString() ?? '',
        vpc: e?.vpc ?? '',
        healthCheckProtocol: e?.healthCheckProtocol ?? ProtocolEnum.HTTP, // TODO: Which?
        healthCheckPort: e?.healthCheckPort?.toString() ?? '',
        healthCheckEnabled: e?.healthCheckEnabled?.toString() ?? '',
        healthCheckIntervalSeconds: e?.healthCheckIntervalSeconds?.toString() ?? '',
        healthCheckTimeoutSeconds: e?.healthCheckTimeoutSeconds?.toString() ?? '',
        unhealthyThresholdCount: e?.unhealthyThresholdCount?.toString() ?? '',
        healthCheckPath: e?.healthCheckPath ?? '',
        protocolVersion: e?.protocolVersion ?? ProtocolVersionEnum.HTTP1, // TODO: Which?
      }),
      equals: (a: TargetGroup, b: TargetGroup) => Object.is(a.targetGroupArn, b.targetGroupArn)
        && Object.is(a.targetGroupName, b.targetGroupName)
        && Object.is(a.targetType, b.targetType)
        && Object.is(a.ipAddressType, b.ipAddressType)
        && Object.is(a.protocol, b.protocol)
        && Object.is(a.port, b.port)
        && Object.is(a.vpc, b.vpc)
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
      cloud: new Crud({
        create: async (es: TargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const vpcs = (await client.getVpcs()).Vpcs;
          const defaultVpc = vpcs.find(vpc => vpc.IsDefault === true) ?? {};
          return await Promise.all(es.map(async (e) => {
            const result = await client.createTargetGroup({
              Name: e.targetGroupName,
              TargetType: e.targetType,
              Port: e.port,
              VpcId: e.vpc === 'default' ? defaultVpc.VpcId ?? '' : e.vpc,
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
        updateOrReplace: (prev: TargetGroup, next: TargetGroup) => {
          if (
            !(Object.is(prev.targetGroupName, next.targetGroupName)
              && Object.is(prev.targetType, next.targetType)
              && Object.is(prev.vpc, next.vpc)
              && Object.is(prev.port, next.port)
              && Object.is(prev.protocol, next.protocol)
              && Object.is(prev.ipAddressType, next.ipAddressType)
              && Object.is(prev.protocolVersion, next.protocolVersion))
          ) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: TargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.TargetGroup?.[e.targetGroupArn ?? ''];
            const isUpdate = AwsElbModule.mappers.targetGroup.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              const updatedTargetGroup = await client.updateTargetGroup({
                TargetGroupArn: e.targetGroupArn,
                // TODO: make this properties not nullable but with default values
                HealthCheckProtocol: e.healthCheckProtocol, // TODO: this one defaults to protocol
                HealthCheckPort: e.healthCheckPort,
                HealthCheckPath: e.healthCheckPath, // TODO: EXCEPT THIS ONE
                HealthCheckEnabled: e.healthCheckEnabled,
                HealthCheckIntervalSeconds: e.healthCheckIntervalSeconds,
                HealthCheckTimeoutSeconds: e.healthCheckTimeoutSeconds,
                HealthyThresholdCount: e.healthyThresholdCount,
                UnhealthyThresholdCount: e.unhealthyThresholdCount,
              });
              return AwsElbModule.utils.targetGroupMapper(updatedTargetGroup, ctx);
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id will be the same in database since `e` will keep it.
              // TODO: what to do when a load balancer depends on the target group??
              await AwsElbModule.mappers.targetGroup.cloud.delete(cloudRecord, ctx);
              return await AwsElbModule.mappers.targetGroup.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (es: TargetGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(e => client.deleteTargetGroup(e.targetGroupArn!)));
        },
      }),
    }),
  },
}, __dirname);
