import { In, } from 'typeorm'
import { Action, Listener, LoadBalancer, } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../../services/gateways/aws'
import {
  ActionTypeEnum,
  AwsAction,
  AwsListener,
  AwsLoadBalancer,
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerStateEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
} from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsElb1637092695969, } from './migration/1637092695969-aws_elb'
import { AwsSecurityGroupModule } from '..'

export const AwsElbModule: Module = new Module({
  name: 'aws_elb',
  dependencies: ['aws_account', 'aws_security_group',],
  provides: {
    tables: ['aws_action', 'aws_listener', 'aws_load_balancer',],
    // functions: ['create_ecr_repository', 'create_ecr_repository_policy'],
  },
  utils: {
    actionMapper: async (a: Action, ctx: Context) => {
      const out = new AwsAction();
      if (!a?.Type || !a?.TargetGroupArn) {
        throw new Error('Listerner action not defined properly');
      }
      out.actionType = (a.Type as ActionTypeEnum);
      out.targetGroup = ctx.memo?.db?.AwsAction?.[a?.TargetGroupArn] ?? await AwsElbModule.mappers.targetGroup.cloud.read(ctx, a.TargetGroupArn);
      return out;
    },
    listenerMapper: async (l: Listener, ctx: Context) => {
      const out = new AwsListener();
      if (!l?.LoadBalancerArn || !l?.Port) {
        throw new Error('Listerner not defined properly');
      }
      out.listenerArn = l?.ListenerArn;
      out.loadBalancer = ctx.memo?.db?.AwsListener?.[l?.LoadBalancerArn] ?? await AwsElbModule.mappers.loadBalancer.cloud.read(ctx, l?.LoadBalancerArn);
      out.port = l?.Port;
      out.protocol = l?.Protocol as ProtocolEnum;
      out.defaultActions = await Promise.all(l.DefaultActions?.map(a => ctx.memo?.db?.AwsAction?.[a?.TargetGroupArn ?? ''] ?? AwsElbModule.utils.actionMapper(a, ctx)) ?? []);
      return out;
    },
    loadBalancerMapper: async (lb: LoadBalancer, ctx: Context) => {
      const out = new AwsLoadBalancer();
      if (!lb?.LoadBalancerName || !lb?.Scheme || !lb?.Type || !lb?.IpAddressType) {
        throw new Error('Load balancer not defined properly');
      }
      out.loadBalancerName = lb.LoadBalancerName;
      out.loadBalancerArn = lb.LoadBalancerArn;
      out.dnsName = lb.DNSName;
      out.canonicalHostedZoneId = lb.CanonicalHostedZoneId;
      out.createdTime = lb.CreatedTime ? new Date(lb.CreatedTime) : lb.CreatedTime;
      out.scheme = lb.Scheme as LoadBalancerSchemeEnum;
      out.state = lb.State as LoadBalancerStateEnum;
      out.loadBalancerType = lb.Type as LoadBalancerTypeEnum;
      out.securityGroups = await Promise.all(lb.SecurityGroups?.map(sg => ctx.memo?.db?.AwsSecurityGroup?.sg ?? AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg)) ?? []);
      out.ipAddressType = lb.IpAddressType as IpAddressType;
      out.customerOwnedIpv4Pool = lb.CustomerOwnedIpv4Pool;
      return out;
    },
  },
  mappers: {
    action: new Mapper<AwsAction>({
      entity: AwsAction,
      entityId: (e: AwsAction) => e?.targetGroup?.targetGroupArn ?? '',
      equals: (_a: AwsAction, _b: AwsAction) => true, // Do not update actions
      source: 'db',
      db: new Crud({
        create: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.save(AwsAction, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const a = await ctx.orm.find(AwsAction, id ? {
            where: {
              targetGroup: { targetGroupArn: Array.isArray(id) ? In(id) : id },
            },
            relations: ['targetGroup'],
          } : { relations: ['targetGroup'], });
          return a;
        },
        update: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.save(AwsAction, e); },
        delete: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.remove(AwsAction, e); },
      }),
      cloud: new Crud({
        create: (_a: AwsAction | AwsAction[], _ctx: Context) => { throw new Error('tbd'); },
        read: (_ctx: Context, _ids?: string | string[]) => { throw new Error('tbd'); },
        update: (_a: AwsAction | AwsAction[], _ctx: Context) => { throw new Error('tbd'); },
        delete: (_a: AwsAction | AwsAction[], _ctx: Context) => { throw new Error('tbd'); },
      }),
    }),
    listener: new Mapper<AwsListener>({
      entity: AwsListener,
      entityId: (e: AwsListener) => e?.listenerArn ?? '',
      equals: (a: AwsListener, b: AwsListener) => Object.is(a.port, b.port)
        && Object.is(a.protocol, b.protocol),
      source: 'db',
      db: new Crud({
        create: async (e: AwsListener | AwsListener[], ctx: Context) => { await ctx.orm.save(AwsListener, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AwsListener, id ? {
            where: {
              listenerArn: Array.isArray(id) ? In(id) : id,
            },
            relations: ["loadBalancer"]
          } : { relations: ["loadBalancer"] });
          return out;
        },
        update: async (l: AwsListener | AwsListener[], ctx: Context) => {
          const es = Array.isArray(l) ? l : [l];
          for (const e of es) {
            if (!e.loadBalancer.id) {
              const lb = await AwsElbModule.mappers.loadBalancer.db.read(ctx, e.loadBalancer.loadBalancerArn);
              e.loadBalancer = lb;
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
            const loadBalancerArns = loadBalancers.map((lb: any) => lb.LoadBalancerArn);
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
        create: async (e: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => { await ctx.orm.save(AwsLoadBalancer, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AwsLoadBalancer, id ? {
            where: {
              loadBalancerArn: Array.isArray(id) ? In(id) : id,
            },
            relations: ["securityGroups"]
          } : { relations: ["securityGroups"] });
          return out;
        },
        update: async (lb: AwsLoadBalancer | AwsLoadBalancer[], ctx: Context) => {
          const es = Array.isArray(lb) ? lb : [lb];
          for (const e of es) {
            for (const [i, sg] of e.securityGroups?.entries() ?? []) {
              if (!sg.id) {
                const g = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg.groupId);
                e.securityGroups![i] = g;
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
              // TODO: Subnets: e.subnets?.map(sn => sn.subnetId!),
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
            return await Promise.all(result.LoadBalancers.map((lb: any) =>  AwsElbModule.utils.loadBalancerMapper(lb, ctx)));
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
  },
  migrations: {
    postinstall: awsElb1637092695969.prototype.up,
    preremove: awsElb1637092695969.prototype.down,
  },
});
