import {
  ElasticLoadBalancingV2,
  paginateDescribeTargetGroups,
  TargetTypeEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2';

import { AwsEc2Module } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsElbModule } from '../../aws_elb';
import { RegisteredInstance } from '../entity';

export class RegisteredInstanceMapper extends MapperBase<RegisteredInstance> {
  module: AwsEc2Module;
  entity = RegisteredInstance;
  entityId = (e: RegisteredInstance) =>
    `${e.instance.instanceId}|${e.targetGroup.targetGroupArn}|${e.port}` ?? '';
  equals = (a: RegisteredInstance, b: RegisteredInstance) => Object.is(a.port, b.port);

  async registeredInstanceMapper(registeredInstance: { [key: string]: string | undefined }, ctx: Context) {
    const out = new RegisteredInstance();
    out.instance =
      (await this.module.instance.db.read(ctx, registeredInstance.instanceId)) ??
      (await this.module.instance.cloud.read(ctx, registeredInstance.instanceId));
    out.targetGroup =
      (await awsElbModule.targetGroup.db.read(ctx, registeredInstance.targetGroupArn)) ??
      (await awsElbModule.targetGroup.cloud.read(ctx, registeredInstance.targetGroupArn));
    out.port = registeredInstance.port ? +registeredInstance.port : undefined;
    return out;
  }

  registerInstance = crudBuilderFormat<ElasticLoadBalancingV2, 'registerTargets', undefined>(
    'registerTargets',
    (Id: string, TargetGroupArn: string, Port?: number) => {
      const target: any = {
        Id,
      };
      if (Port) target.Port = Port;
      return {
        TargetGroupArn,
        Targets: [target],
      };
    },
    _res => undefined
  );

  getRegisteredInstance = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'describeTargetHealth',
    { targetGroupArn: string; instanceId: string | undefined; port: string | undefined } | undefined
  >(
    'describeTargetHealth',
    (Id: string, TargetGroupArn: string, Port?: string) => {
      const target: any = { Id };
      if (Port) target.Port = Port.toString();
      return {
        TargetGroupArn,
        Targets: [target],
      };
    },
    (res, _Id, TargetGroupArn, _Port?) =>
      [
        ...(res?.TargetHealthDescriptions?.map(thd => ({
          targetGroupArn: TargetGroupArn,
          instanceId: thd.Target?.Id,
          port: thd.Target?.Port?.toString(),
        })) ?? []),
      ].pop()
  );

  getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeTargetGroups, 'TargetGroups');

  // TODO: Macro-ify this
  async getRegisteredInstances(client: ElasticLoadBalancingV2) {
    const targetGroups = await this.getTargetGroups(client);
    const instanceTargetGroups =
      targetGroups.filter(tg => Object.is(tg.TargetType, TargetTypeEnum.INSTANCE)) ?? [];
    const out = [];
    for (const tg of instanceTargetGroups) {
      const res = await client.describeTargetHealth({
        TargetGroupArn: tg.TargetGroupArn,
      });
      out.push(
        ...(res.TargetHealthDescriptions?.map(thd => ({
          targetGroupArn: tg.TargetGroupArn,
          instanceId: thd.Target?.Id,
          port: thd.Target?.Port?.toString(),
        })) ?? [])
      );
    }
    return out;
  }

  deregisterInstance = crudBuilderFormat<ElasticLoadBalancingV2, 'deregisterTargets', undefined>(
    'deregisterTargets',
    (Id: string, TargetGroupArn: string, Port?: number) => {
      const target: any = {
        Id,
      };
      if (Port) target.Port = Port;
      return {
        TargetGroupArn,
        Targets: [target],
      };
    },
    _res => undefined
  );

  db = new Crud2<RegisteredInstance>({
    create: (es: RegisteredInstance[], ctx: Context) => ctx.orm.save(RegisteredInstance, es),
    update: (es: RegisteredInstance[], ctx: Context) => ctx.orm.save(RegisteredInstance, es),
    delete: (es: RegisteredInstance[], ctx: Context) => ctx.orm.remove(RegisteredInstance, es),
    read: async (ctx: Context, instAndTgArnAndPort?: string) => {
      const opts = instAndTgArnAndPort
        ? {
            where: {
              instance: {
                instanceId: instAndTgArnAndPort.split('|')[0],
              },
              targetGroup: {
                targetGroupArn: instAndTgArnAndPort.split('|')[1],
              },
              port: instAndTgArnAndPort.split('|')[2],
            },
          }
        : {};
      return await ctx.orm.find(RegisteredInstance, opts);
    },
  });

  cloud: Crud2<RegisteredInstance> = new Crud2({
    create: async (es: RegisteredInstance[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        if (!e.port) {
          e.port = e.targetGroup.port;
        }
        await this.registerInstance(
          client.elbClient,
          e.instance.instanceId,
          e.targetGroup.targetGroupArn,
          e.port
        );
        const registeredInstance = await this.module.registeredInstance.cloud.read(
          ctx,
          this.module.registeredInstance.entityId(e)
        );
        await this.module.registeredInstance.db.update(registeredInstance, ctx);
        out.push(registeredInstance);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const [instanceId, targetGroupArn, port] = id.split('|');
        if (!instanceId || !targetGroupArn) return undefined;
        const registeredInstance = await this.getRegisteredInstance(
          client.elbClient,
          instanceId,
          targetGroupArn,
          port
        );
        if (!registeredInstance) return undefined;
        return await this.registeredInstanceMapper(registeredInstance, ctx);
      }
      const registeredInstances = (await this.getRegisteredInstances(client.elbClient)) ?? [];
      const out = [];
      for (const i of registeredInstances) {
        const outInst = await this.registeredInstanceMapper(i, ctx);
        if (outInst) out.push(outInst);
      }
      return out;
    },
    updateOrReplace: () => 'replace',
    update: async (es: RegisteredInstance[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord =
          ctx?.memo?.cloud?.RegisteredInstance?.[this.module.registeredInstance.entityId(e)];
        if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        if (!cloudRecord.instance?.instanceId || !cloudRecord.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        if (!e.port) e.port = e.targetGroup.port;
        await this.registerInstance(
          client.elbClient,
          e.instance.instanceId,
          e.targetGroup.targetGroupArn,
          e.port
        );
        await this.deregisterInstance(
          client.elbClient,
          cloudRecord.instance.instanceId,
          cloudRecord.targetGroup.targetGroupArn,
          cloudRecord.port
        );
        const registeredInstance = await this.module.registeredInstance.cloud.read(
          ctx,
          this.module.registeredInstance.entityId(e)
        );
        await this.module.registeredInstance.db.update(registeredInstance, ctx);
        out.push(registeredInstance);
      }
      return out;
    },
    delete: async (es: RegisteredInstance[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        await this.deregisterInstance(
          client.elbClient,
          e.instance.instanceId,
          e.targetGroup.targetGroupArn,
          e.port
        );
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
