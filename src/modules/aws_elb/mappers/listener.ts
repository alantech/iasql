import {
  CreateListenerCommandInput,
  ElasticLoadBalancingV2,
  Listener as ListenerAws,
  ModifyListenerCommandInput,
  paginateDescribeListeners,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsElbModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import { awsAcmModule } from '../../aws_acm';
import { Context, Crud, MapperBase } from '../../interfaces';
import { ActionTypeEnum, Listener, LoadBalancer, ProtocolEnum } from '../entity';

export class ListenerMapper extends MapperBase<Listener> {
  module: AwsElbModule;
  entity = Listener;
  equals = (a: Listener, b: Listener) =>
    Object.is(a.listenerArn, b.listenerArn) &&
    Object.is(a.loadBalancer.loadBalancerArn, b.loadBalancer.loadBalancerArn) &&
    Object.is(a.port, b.port) &&
    Object.is(a.protocol, b.protocol) &&
    Object.is(a.actionType, b.actionType) &&
    Object.is(a.targetGroup.targetGroupArn, b.targetGroup.targetGroupArn) &&
    Object.is(a.sslPolicy, b.sslPolicy) &&
    Object.is(a.certificate?.arn, b.certificate?.arn);

  async listenerMapper(l: ListenerAws, ctx: Context) {
    const out = new Listener();
    if (!l?.LoadBalancerArn || !l?.Port) return undefined;
    out.listenerArn = l?.ListenerArn;
    out.loadBalancer =
      ctx.memo?.db?.LoadBalancer?.[l.LoadBalancerArn] ??
      (await this.module.loadBalancer.db.read(ctx, l?.LoadBalancerArn));
    out.port = l?.Port;
    out.protocol = l?.Protocol as ProtocolEnum;
    let hasTargetGroup = false;
    for (const a of l?.DefaultActions ?? []) {
      if (!a.TargetGroupArn) break; // we will skip the ones without target group
      if (a.Type === ActionTypeEnum.FORWARD) {
        out.actionType = a.Type as ActionTypeEnum;
        out.targetGroup =
          (await this.module.targetGroup.db.read(ctx, a?.TargetGroupArn)) ??
          (await this.module.targetGroup.cloud.read(ctx, a?.TargetGroupArn));
        if (!out.targetGroup) break;
        else hasTargetGroup = true; // it is a valid action
      }
    }
    if (!hasTargetGroup) return undefined;
    if (l.SslPolicy && l.Certificates?.length) {
      out.sslPolicy = l.SslPolicy;
      const cloudCertificate = l.Certificates.pop();
      out.certificate =
        (await awsAcmModule.certificate.db.read(ctx, cloudCertificate?.CertificateArn)) ??
        (await awsAcmModule.certificate.cloud.read(ctx, cloudCertificate?.CertificateArn));
    }
    return out;
  }

  createListener = crudBuilderFormat<ElasticLoadBalancingV2, 'createListener', ListenerAws | undefined>(
    'createListener',
    input => input,
    res => res?.Listeners?.pop(),
  );
  getListener = crudBuilderFormat<ElasticLoadBalancingV2, 'describeListeners', ListenerAws | undefined>(
    'describeListeners',
    arn => ({ ListenerArns: [arn] }),
    res => res?.Listeners?.[0],
  );
  getListenersForArn = paginateBuilder<ElasticLoadBalancingV2>(
    paginateDescribeListeners,
    'Listeners',
    undefined,
    undefined,
    LoadBalancerArn => ({ LoadBalancerArn }),
  );
  getListeners = async (client: ElasticLoadBalancingV2, loadBalancerArns: string[]) =>
    (await mapLin(loadBalancerArns, this.getListenersForArn.bind(null, client))).flat();
  updateListener = crudBuilderFormat<ElasticLoadBalancingV2, 'modifyListener', ListenerAws | undefined>(
    'modifyListener',
    input => input,
    res => res?.Listeners?.pop(),
  );
  deleteListener = crudBuilder<ElasticLoadBalancingV2, 'deleteListener'>('deleteListener', ListenerArn => ({
    ListenerArn,
  }));

  cloud: Crud<Listener> = new Crud({
    create: async (es: Listener[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        if (e.loadBalancer && e.loadBalancer.region !== e.targetGroup.region)
          throw new Error('Target group and load balancer are not from the same region.');

        const region = e.targetGroup.region;
        const client = (await ctx.getAwsClient(region)) as AWS;
        const listenerInput: CreateListenerCommandInput = {
          Port: e.port,
          Protocol: e.protocol,
          LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
          DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
        };
        if (e.certificate) {
          listenerInput.SslPolicy = e.sslPolicy ?? 'ELBSecurityPolicy-2016-08';
          listenerInput.Certificates = [
            {
              CertificateArn: e.certificate.arn,
            },
          ];
        }
        const result = await this.createListener(client.elbClient, listenerInput);
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('ListenerArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getListener(client.elbClient, result.ListenerArn ?? '');
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.listenerMapper(newObject, ctx);
        if (!newEntity) continue;
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.listener.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, arn?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (arn) {
        const region = parseArn(arn).region;
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawListener = await this.getListener(client.elbClient, arn);
          if (!rawListener) return;
          return await this.listenerMapper(rawListener, ctx);
        }
      } else {
        const out: Listener[] = [];
        const loadBalancers = ctx.memo?.cloud?.LoadBalancer
          ? Object.values(ctx.memo?.cloud?.LoadBalancer)
          : await this.module.loadBalancer.cloud.read(ctx);

        await Promise.all(
          loadBalancers.map(async (lb: LoadBalancer) => {
            const client = (await ctx.getAwsClient(lb.region)) as AWS;
            const listeners = await this.getListenersForArn(client.elbClient, lb.loadBalancerArn);
            for (const l of listeners) {
              const o = await this.listenerMapper(l, ctx);
              if (o) out.push(o);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: Listener, next: Listener) => {
      if (!Object.is(prev.loadBalancer.loadBalancerArn, next.loadBalancer.loadBalancerArn)) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: Listener[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Listener?.[e.listenerArn ?? ''];
        const isUpdate = this.module.listener.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const listenerInput: ModifyListenerCommandInput = {
            ListenerArn: e.listenerArn,
            Port: e.port,
            Protocol: e.protocol,
            DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
          };
          if (e.certificate) {
            listenerInput.SslPolicy = e.sslPolicy ?? 'ELBSecurityPolicy-2016-08';
            listenerInput.Certificates = [
              {
                CertificateArn: e.certificate.arn,
              },
            ];
          }
          const updatedListener = await this.updateListener(client.elbClient, listenerInput);
          if (!updatedListener) continue;
          const o = await this.listenerMapper(updatedListener, ctx);
          if (o) out.push(o);
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id in database will be the same `e` will keep it.
          await this.module.listener.cloud.delete(cloudRecord, ctx);
          const o = await this.module.listener.cloud.create(e, ctx);
          if (!o) continue;
          if (o instanceof Array) {
            out.push(...o);
          } else {
            out.push(o);
          }
        }
      }
      return out;
    },
    delete: async (es: Listener[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteListener(client.elbClient, e.listenerArn!);
      }
    },
  });

  constructor(module: AwsElbModule) {
    super();
    this.module = module;
    super.init();
  }
}
