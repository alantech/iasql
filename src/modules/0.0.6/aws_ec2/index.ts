import { Instance as AWSInstance } from '@aws-sdk/client-ec2'

import { Instance, RegisteredInstance } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS } from '../../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'
import { AwsElbModule } from '../aws_elb'

export const AwsEc2Module: Module = new Module({
  ...metadata,
  utils: {
    instanceMapper: async (instance: AWSInstance, ctx: Context) => {
      const out = new Instance();
      out.instanceId = instance.InstanceId;
      const tags: {[key: string]: string} = {};
      (instance.Tags || []).filter(t => !!t.Key && !!t.Value).forEach(t => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
      out.ami = instance.ImageId ?? '';
      if (instance.KeyName) out.keyPairName = instance.KeyName;
      out.instanceType = instance.InstanceType ?? '';
      if (!out.instanceType) throw new Error('Cannot create Instance object without a valid InstanceType in the Database');
      out.securityGroups = await AwsSecurityGroupModule.mappers.securityGroup.db.read(
        ctx,
        instance.SecurityGroups?.map(sg => sg.GroupId).filter(id => !!id) as string[],
      );
      return out;
    },
    registredInstanceMapper: async (registredInstance: { [key: string]: string }, ctx: Context) => {
      const out = new RegisteredInstance();
      out.instance = await AwsEc2Module.mappers.instance.db.read(ctx, registredInstance.instanceId) ??
        await AwsEc2Module.mappers.instance.cloud.read(ctx, registredInstance.instanceId);
      out.targetGroup = await AwsElbModule.mappers.targetGroup.db.read(ctx, registredInstance.targetGroupArn) ??
        await AwsElbModule.mappers.targetGroup.cloud.read(ctx, registredInstance.targetGroupArn);
      return out;
    },
  },
  mappers: {
    instance: new Mapper<Instance>({
      entity: Instance,
      equals: (a: Instance, b: Instance) => Object.is(a.instanceId, b.instanceId) &&
        Object.is(a.ami, b.ami) &&
        Object.is(a.instanceType, b.instanceType) &&
        Object.is(a.keyPairName, b.keyPairName) &&
        Object.is(Object.keys(a.tags ?? {})?.length, Object.keys(b.tags ?? {})?.length) &&
        Object.keys(a.tags ?? {})?.every(ak => (a.tags ?? {})[ak] === (b.tags ?? {})[ak]) &&
        Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
        a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))),
      source: 'db',
      cloud: new Crud({
        create: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const instance of es) {
            if (instance.ami) {
              const instanceId = await client.newInstanceV2(
                instance.instanceType,
                instance.ami,
                instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[],
                instance.keyPairName,
                instance.tags
              );
              if (!instanceId) { // then who?
                throw new Error('should not be possible');
              }
              instance.instanceId = instanceId;
              await AwsEc2Module.mappers.instance.db.update(instance, ctx);
            }
          }
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const instances = Array.isArray(ids) ? await (async () => {
            const o = [];
            for (const id of ids) {
              o.push(await client.getInstance(id));
            }
            return o;
          })() :
            (await client.getInstances()).Instances ?? [];
          // ignore instances in "Terminated" and "Shutting down" state
          const out = [];
          for (const i of instances) {
            if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
            out.push(await AwsEc2Module.utils.instanceMapper(i, ctx));
          }
          return out;
        },
        updateOrReplace: (_a: Instance, _b: Instance) => 'replace',
        update: async (es: Instance[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Instance?.[e.instanceId ?? ''];
            const created = await AwsEc2Module.mappers.instance.cloud.create([e], ctx);
            await AwsEc2Module.mappers.instance.cloud.delete([cloudRecord], ctx);
            out.push(created);
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
    registeredInstances: new Mapper<RegisteredInstance>({
      entity: RegisteredInstance,
      entityId: (e: RegisteredInstance) => e.id?.toString() ?? '',
      equals: (a: RegisteredInstance, b: RegisteredInstance) => Object.is(a.instance.instanceId, b.instance.instanceId) &&
        Object.is(a.targetGroup.targetGroupArn, b.targetGroup.targetGroupArn),
      source: 'db',
      cloud: new Crud({
        create: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            await client.registerInstance(e.instance.instanceId, e.targetGroup.targetGroupArn);
            out.push(e);
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            // Just return empty array. Since theres no really a cloud id this should never be called.
            return [];
          }
          const registredInstances = await client.getRegisteredInstances() ?? [];
          const out = [];
          for (const i of registredInstances) {
            out.push(await AwsEc2Module.utils.registredInstanceMapper(i, ctx));
          }
          return out;
        },
        updateOrReplace: () => 'update',
        update: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.RegisteredInstance?.[e.id ?? ''];
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            if (!cloudRecord.instance?.instanceId || !cloudRecord.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            await client.registerInstance(e.instance.instanceId, e.targetGroup.targetGroupArn);
            await client.deregisterInstance(cloudRecord.instance.instanceId, cloudRecord.targetGroup.targetGroupArn);
            out.push(e);
          }
          return out;
        },
        delete: async (es: RegisteredInstance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn) throw new Error('Valid targetGroup and instance needed.');
            await client.deregisterInstance(e.instance.instanceId, e.targetGroup.targetGroupArn);
          }
        },
      }),
    }),
  },
}, __dirname);