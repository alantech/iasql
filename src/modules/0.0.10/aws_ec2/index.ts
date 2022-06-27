import {
  EC2,
  Instance as AWSInstance,
  InstanceLifecycle,
  RunInstancesCommandInput,
  DescribeInstancesCommandInput,
  paginateDescribeInstances,
  Tag as AWSTag,
} from '@aws-sdk/client-ec2'
import {
  ElasticLoadBalancingV2,
  paginateDescribeTargetGroups,
  TargetTypeEnum,
  DescribeTargetHealthCommandOutput,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'

import { Instance, RegisteredInstance, State, } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS, crudBuilder, paginateBuilder, } from '../../../services/aws_macros'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'
import { AwsElbModule } from '../aws_elb'

const getInstanceUserData = crudBuilder<EC2>(
  'describeInstanceAttribute',
  (InstanceId: string) => ({ Attribute: 'userData', InstanceId, }),
  (res: any) => res.UserData?.Value,
);
// TODO: Macro-ify the waiter usage
async function newInstance(client: EC2, newInstancesInput: RunInstancesCommandInput): Promise<string> {
  const create = await client.runInstances(newInstancesInput);
  const instanceIds: string[] | undefined = create.Instances?.map((i) => i?.InstanceId ?? '');
  const input: DescribeInstancesCommandInput = {
    InstanceIds: instanceIds,
  };
  // TODO: should we use the paginator instead?
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.PublicIpAddress === undefined || instance.State?.Name !== 'running')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.RETRY };
        throw e;
      }
    },
  );
  return instanceIds?.pop() ?? '';
}
const describeInstances = crudBuilder<EC2>(
  'describeInstances',
  (InstanceIds: string[]) => ({ InstanceIds, }),
);
const getInstance = async (client: EC2, id: string) => {
  const reservations = await describeInstances(client, [id]);
  return (reservations?.Reservations?.map((r: any) => r.Instances) ?? []).pop()?.pop();
}
const getInstances = paginateBuilder<EC2>(paginateDescribeInstances, 'Instances', 'Reservations');
// TODO: Macro-ify this somehow?
async function updateTags(client: EC2, resourceId: string, tags?: { [key: string] : string }) {
  let tgs: AWSTag[] = [];
  if (tags) {
    tgs = Object.keys(tags).map(k => {
      return {
        Key: k, Value: tags[k]
      }
    });
  }
  // recreate tags
  await client.deleteTags({
    Resources: [resourceId],
  });
  await client.createTags({
    Resources: [resourceId],
    Tags: tgs,
  })
}
// TODO: More to fix
async function startInstance(client: EC2, instanceId: string) {
  await client.startInstances({
    InstanceIds: [instanceId],
  });
  const input: DescribeInstancesCommandInput = {
    InstanceIds: [instanceId],
  };
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.State?.Name !== 'running')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.SUCCESS };
        throw e;
      }
    },
  );
}
// TODO: Macro-ify this
async function stopInstance(client: EC2, instanceId: string, hibernate = false) {
  await client.stopInstances({
    InstanceIds: [instanceId],
    Hibernate: hibernate,
  });
  const input: DescribeInstancesCommandInput = {
    InstanceIds: [instanceId],
  };
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.State?.Name !== 'stopped')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.SUCCESS };
        throw e;
      }
    },
  );
}
const terminateInstance = crudBuilder<EC2>(
  'terminateInstances',
  (id: string) => ({ InstanceIds: [id], }),
  (res: any) => (res?.TerminatingInstances ?? []).pop(),
);
const registerInstance = crudBuilder<ElasticLoadBalancingV2>(
  'registerTargets',
  (Id: string, TargetGroupArn: string, Port?: number) => {
    const target: any = {
      Id,
    };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    }
  },
  (_res: any) => undefined,
);
const getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(
  paginateDescribeTargetGroups,
  'TargetGroups',
);
// TODO: Macro-ify this
async function getRegisteredInstances(client: ElasticLoadBalancingV2) {
  const targetGroups = await getTargetGroups(client);
  const instanceTargetGroups = targetGroups.filter(tg => Object.is(tg.TargetType, TargetTypeEnum.INSTANCE)) ?? [];
  const out = [];
  for (const tg of instanceTargetGroups) {
    const res = await client.describeTargetHealth({
      TargetGroupArn: tg.TargetGroupArn,
    });
    out.push(...(res.TargetHealthDescriptions?.map(thd => (
      {
        targetGroupArn: tg.TargetGroupArn,
        instanceId: thd.Target?.Id,
        port: thd.Target?.Port,
      }
    )) ?? []));
  }
  return out;
}
const getRegisteredInstance = crudBuilder<ElasticLoadBalancingV2>(
  'describeTargetHealth',
  (Id: string, TargetGroupArn: string, Port?: string) => {
    const target: any = { Id, };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    };
  },
  (res: DescribeTargetHealthCommandOutput, _Id: string, TargetGroupArn: string, _Port?: string) => [
    ...(res.TargetHealthDescriptions?.map(thd => ({
      targetGroupArn: TargetGroupArn,
      instanceId: thd.Target?.Id,
      port: thd.Target?.Port,
    })) ?? [])
  ].pop(),
);
const deregisterInstance = crudBuilder<ElasticLoadBalancingV2>(
  'deregisterTargets',
  (Id: string, TargetGroupArn: string, Port?: number) => {
    const target: any = {
      Id,
    };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    }
  },
  (_res: any) => undefined,
);

export const AwsEc2Module: Module2 = new Module2({
  ...metadata,
  utils: {
    instanceMapper: async (instance: AWSInstance, ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = new Instance();
      if (!instance.InstanceId) return undefined;
      out.instanceId = instance.InstanceId;
      const tags: { [key: string]: string } = {};
      (instance.Tags || []).filter(t => !!t.Key && !!t.Value).forEach(t => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
      const userDataBase64 = await getInstanceUserData(client.ec2client, out.instanceId);
      out.userData = userDataBase64 ? Buffer.from(userDataBase64, 'base64').toString('ascii') : undefined;
      if (instance.State?.Name === State.STOPPED) out.state = State.STOPPED
      // map interim states to running
      else out.state = State.RUNNING;
      out.ami = instance.ImageId ?? '';
      if (instance.KeyName) out.keyPairName = instance.KeyName;
      out.instanceType = instance.InstanceType ?? '';
      if (!out.instanceType) return undefined;
      out.securityGroups = [];
      for (const sgId of instance.SecurityGroups?.map(sg => sg.GroupId) ?? []) {
        const sg = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId);
        if (sg) out.securityGroups.push(sg);
      }
      return out;
    },
    instanceEqReplaceableFields: (a: Instance, b: Instance) => Object.is(a.instanceId, b.instanceId) &&
      Object.is(a.ami, b.ami) &&
      Object.is(a.instanceType, b.instanceType) &&
      Object.is(a.userData, b.userData) &&
      Object.is(a.keyPairName, b.keyPairName) &&
      Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
      a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))),
    instanceEqTags: (a: Instance, b: Instance) => Object.is(Object.keys(a.tags ?? {})?.length, Object.keys(b.tags ?? {})?.length) &&
      Object.keys(a.tags ?? {})?.every(ak => (a.tags ?? {})[ak] === (b.tags ?? {})[ak]),
    registeredInstanceMapper: async (registeredInstance: { [key: string]: string }, ctx: Context) => {
      const out = new RegisteredInstance();
      out.instance = await AwsEc2Module.mappers.instance.db.read(ctx, registeredInstance.instanceId) ??
        await AwsEc2Module.mappers.instance.cloud.read(ctx, registeredInstance.instanceId);
      out.targetGroup = await AwsElbModule.mappers.targetGroup.db.read(ctx, registeredInstance.targetGroupArn) ??
        await AwsElbModule.mappers.targetGroup.cloud.read(ctx, registeredInstance.targetGroupArn);
      out.port = registeredInstance.port ? +registeredInstance.port : undefined;
      return out;
    },
  },
  mappers: {
    instance: new Mapper2<Instance>({
      entity: Instance,
      equals: (a: Instance, b: Instance) => Object.is(a.state, b.state) &&
        AwsEc2Module.utils.instanceEqReplaceableFields(a, b) &&
        AwsEc2Module.utils.instanceEqTags(a, b),
      source: 'db',
      cloud: new Crud2({
        create: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const instance of es) {
            if (instance.ami) {
              let tgs: AWSTag[] = [];
              if (instance.tags !== undefined) {
                const tags: {[key: string]: string} = instance.tags;
                tags.owner = 'iasql-engine';
                tgs = Object.keys(tags).map(k => {
                  return {
                    Key: k, Value: tags[k]
                  }
                });
              }
              const sgIds = instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[];
              const userData = instance.userData ? Buffer.from(instance.userData).toString('base64') : undefined;
              const instanceParams: RunInstancesCommandInput = {
                ImageId: instance.ami,
                InstanceType: instance.instanceType,
                MinCount: 1,
                MaxCount: 1,
                SecurityGroupIds: sgIds,
                TagSpecifications: [
                  {
                    ResourceType: 'instance',
                    Tags: tgs,
                  },
                ],
                KeyName: instance.keyPairName,
                UserData: userData,
              };
              const instanceId = await newInstance(client.ec2client, instanceParams);
              if (!instanceId) { // then who?
                throw new Error('should not be possible');
              }
              const newEntity = await AwsEc2Module.mappers.instance.cloud.read(ctx, instanceId);
              newEntity.id = instance.id;
              await AwsEc2Module.mappers.instance.db.update(newEntity, ctx);
              out.push(newEntity);
            }
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawInstance = await getInstance(client.ec2client, id);
            // exclude spot instances
            if (!rawInstance || rawInstance.InstanceLifecycle === InstanceLifecycle.SPOT) return;
            if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down') return;
            return AwsEc2Module.utils.instanceMapper(rawInstance, ctx);
          } else {
            const rawInstances = (await getInstances(client.ec2client)) ?? [];
            const out = [];
            for (const i of rawInstances) {
              if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
              out.push(await AwsEc2Module.utils.instanceMapper(i, ctx));
            }
            return out;
          }
        },
        updateOrReplace: (_a: Instance, _b: Instance) => 'replace',
        update: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Instance?.[e.instanceId ?? ''];
            if (AwsEc2Module.utils.instanceEqReplaceableFields(e, cloudRecord)) {
              const insId = e.instanceId as string;
              if (!AwsEc2Module.utils.instanceEqTags(e, cloudRecord) && e.instanceId && e.tags) {
                await updateTags(client.ec2client, insId, e.tags);
              }
              if (!Object.is(e.state, cloudRecord.state) && e.instanceId) {
                if (cloudRecord.state === State.STOPPED && e.state === State.RUNNING) {
                  await startInstance(client.ec2client, insId);
                } else if (cloudRecord.state === State.RUNNING && e.state === State.STOPPED) {
                  await stopInstance(client.ec2client, insId);
                } else {
                  throw new Error(`Invalid instance state transition. From CLOUD state ${cloudRecord.state} to DB state ${e.state}`);
                }
              }
              out.push(e);
            } else {
              const created = await AwsEc2Module.mappers.instance.cloud.create([e], ctx);
              await AwsEc2Module.mappers.instance.cloud.delete([cloudRecord], ctx);
              out.push(created);
            }
          }
          return out;
        },
        delete: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const entity of es) {
            if (entity.instanceId) await terminateInstance(client.ec2client, entity.instanceId);
          }
        },
      }),
    }),
    registeredInstance: new Mapper2<RegisteredInstance>({
      entity: RegisteredInstance,
      entityId: (e: RegisteredInstance) => `${e.instance.instanceId}|${e.targetGroup.targetGroupArn}|${e.port}` ?? '',
      equals: (a: RegisteredInstance, b: RegisteredInstance) => Object.is(a.port, b.port),
      source: 'db',
      cloud: new Crud2({
        create: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            if (!e.port) {
              e.port = e.targetGroup.port;
            }
            await registerInstance(client.elbClient, e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
            const registeredInstance = await AwsEc2Module.mappers.registeredInstance.cloud.read(ctx, AwsEc2Module.mappers.registeredInstance.entityId(e));
            await AwsEc2Module.mappers.registeredInstance.db.update(registeredInstance, ctx);
            out.push(registeredInstance);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const [instanceId, targetGroupArn, port] = id.split('|');
            if (!instanceId || !targetGroupArn) return undefined;
            const registeredInstance = await getRegisteredInstance(client.elbClient, instanceId, targetGroupArn, port);
            return await AwsEc2Module.utils.registeredInstanceMapper(registeredInstance, ctx);
          }
          const registeredInstances = await getRegisteredInstances(client.elbClient) ?? [];
          const out = [];
          for (const i of registeredInstances) {
            out.push(await AwsEc2Module.utils.registeredInstanceMapper(i, ctx));
          }
          return out;
        },
        updateOrReplace: () => 'replace',
        update: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.RegisteredInstance?.[AwsEc2Module.mappers.registeredInstance.entityId(e)];
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            if (!cloudRecord.instance?.instanceId || !cloudRecord.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            if (!e.port) {
              e.port = e.targetGroup.port;
            }
            await registerInstance(client.elbClient, e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
            await deregisterInstance(client.elbClient, cloudRecord.instance.instanceId, cloudRecord.targetGroup.targetGroupArn, cloudRecord.port);
            const registeredInstance = await AwsEc2Module.mappers.registeredInstance.cloud.read(ctx, AwsEc2Module.mappers.registeredInstance.entityId(e));
            await AwsEc2Module.mappers.registeredInstance.db.update(registeredInstance, ctx);
            out.push(registeredInstance);
          }
          return out;
        },
        delete: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            await deregisterInstance(client.elbClient, e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
          }
        },
      }),
    }),
  },
}, __dirname);