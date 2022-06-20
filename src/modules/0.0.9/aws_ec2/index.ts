import { Instance as AWSInstance, RunInstancesCommandInput, Tag as AWSTag } from '@aws-sdk/client-ec2'

import { Instance, RegisteredInstance, State, } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS } from '../../../services/gateways/aws_2'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'
import { AwsElbModule } from '../aws_elb'

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
      const userDataBase64 = await client.getInstanceUserData(out.instanceId);
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
              const instanceId = await client.newInstance(instanceParams);
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
            const rawInstance = await client.getInstance(id);
            // exclude spot instances
            if (!rawInstance || rawInstance.InstanceLifecycle === 'spot') return;
            if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down') return;
            return AwsEc2Module.utils.instanceMapper(rawInstance, ctx);
          } else {
            const rawInstances = (await client.getInstances()).Instances ?? [];
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
                await client.updateTags(insId, e.tags);
              }
              if (!Object.is(e.state, cloudRecord.state) && e.instanceId) {
                if (cloudRecord.state === State.STOPPED && e.state === State.RUNNING) {
                  await client.startInstance(insId);
                } else if (cloudRecord.state === State.RUNNING && e.state === State.STOPPED) {
                  await client.stopInstance(insId);
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
            if (entity.instanceId) await client.terminateInstance(entity.instanceId);
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
            await client.registerInstance(e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
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
            const registeredInstance = await client.getRegisteredInstance(instanceId, targetGroupArn, port);
            return await AwsEc2Module.utils.registeredInstanceMapper(registeredInstance, ctx);
          }
          const registeredInstances = await client.getRegisteredInstances() ?? [];
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
            await client.registerInstance(e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
            await client.deregisterInstance(cloudRecord.instance.instanceId, cloudRecord.targetGroup.targetGroupArn, cloudRecord.port);
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
            await client.deregisterInstance(e.instance.instanceId, e.targetGroup.targetGroupArn, e.port);
          }
        },
      }),
    }),
  },
}, __dirname);