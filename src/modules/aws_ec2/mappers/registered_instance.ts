import {
  ElasticLoadBalancingV2,
  paginateDescribeTargetGroups,
  TargetTypeEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2';

import { AwsEc2Module } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsElbModule } from '../../aws_elb';
import { Context, Crud, IdFields, MapperBase } from '../../interfaces';
import { RegisteredInstance } from '../entity';

export class RegisteredInstanceMapper extends MapperBase<RegisteredInstance> {
  module: AwsEc2Module;
  entity = RegisteredInstance;
  generateId = (fields: IdFields) => {
    const requiredFields = ['instanceId', 'targetGroupArn', 'port', 'region'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.instanceId}|${fields.targetGroupArn}|${fields.port}|${fields.region}`;
  };
  entityId = (e: RegisteredInstance) =>
    this.generateId({
      instanceId: e.instance.instanceId ?? '',
      targetGroupArn: e.targetGroup.targetGroupArn ?? '',
      port: (e.port ?? e.targetGroup.port ?? '') + '',
      region: e.region,
    });
  equals = (_a: RegisteredInstance, _b: RegisteredInstance) => {
    // Because *all* fields are part of the ID, this is always true
    return true;
  };

  async registeredInstanceMapper(
    registeredInstance: { [key: string]: string | undefined },
    region: string,
    ctx: Context,
  ) {
    const out = new RegisteredInstance();
    out.instance =
      (await this.module.instance.db.read(
        ctx,
        this.module.instance.generateId({ instanceId: registeredInstance.instanceId ?? '', region }),
      )) ??
      (await this.module.instance.cloud.read(
        ctx,
        this.module.instance.generateId({ instanceId: registeredInstance.instanceId ?? '', region }),
      ));
    out.targetGroup =
      (await awsElbModule.targetGroup.db.read(ctx, registeredInstance.targetGroupArn)) ??
      (await awsElbModule.targetGroup.cloud.read(ctx, registeredInstance.targetGroupArn));
    out.port = registeredInstance.port ? +registeredInstance.port : undefined;
    out.region = region;
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
    _res => undefined,
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
      ].pop(),
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
        })) ?? []),
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
    _res => undefined,
  );

  db = new Crud<RegisteredInstance>({
    create: (es: RegisteredInstance[], ctx: Context) => ctx.orm.save(RegisteredInstance, es),
    update: (es: RegisteredInstance[], ctx: Context) => ctx.orm.save(RegisteredInstance, es),
    delete: (es: RegisteredInstance[], ctx: Context) => ctx.orm.remove(RegisteredInstance, es),
    read: async (ctx: Context, id?: string) => {
      const opts = id
        ? {
            where: {
              instance: {
                instanceId: id.split('|')[0],
              },
              targetGroup: {
                targetGroupArn: id.split('|')[1],
              },
              port: id.split('|')[2],
              region: id.split('|')[3],
            },
          }
        : undefined;
      return await ctx.orm.find(RegisteredInstance, opts);
    },
  });

  cloud: Crud<RegisteredInstance> = new Crud({
    create: async (es: RegisteredInstance[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        if (!e.port) {
          e.port = e.targetGroup.port;
        }
        await this.registerInstance(
          client.elbClient,
          e.instance.instanceId,
          e.targetGroup.targetGroupArn,
          e.port,
        );
        const registeredInstance = await this.module.registeredInstance.cloud.read(ctx, this.entityId(e));
        registeredInstance.id = e.id;
        await this.module.registeredInstance.db.update(registeredInstance, ctx);
        out.push(registeredInstance);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        const [instanceId, targetGroupArn, port, region] = id.split('|');
        const client = (await ctx.getAwsClient(region)) as AWS;
        if (!instanceId || !targetGroupArn) return undefined;
        const registeredInstance = await this.getRegisteredInstance(
          client.elbClient,
          instanceId,
          targetGroupArn,
          port,
        );
        if (!registeredInstance) return undefined;
        return await this.registeredInstanceMapper(registeredInstance, region, ctx);
      }
      const out: RegisteredInstance[] = [];
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const registeredInstances = (await this.getRegisteredInstances(client.elbClient)) ?? [];
          for (const i of registeredInstances) {
            const outInst = await this.registeredInstanceMapper(i, region, ctx);
            if (outInst) out.push(outInst);
          }
        }),
      );
      return out;
    },
    updateOrReplace: () => 'replace',
    update: async (_es: RegisteredInstance[], _ctx: Context) => {
      throw new Error('This should be unreachable');
    },
    delete: async (es: RegisteredInstance[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
          throw new Error('Valid targetGroup and instance needed.');
        await this.deregisterInstance(
          client.elbClient,
          e.instance.instanceId,
          e.targetGroup.targetGroupArn,
          e.port,
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
