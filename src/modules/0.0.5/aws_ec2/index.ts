import { Instance as AWSInstance } from '@aws-sdk/client-ec2'

import { Instance, State } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS } from '../../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsEc2Module: Module = new Module({
  ...metadata,
  utils: {
    instanceMapper: async (instance: AWSInstance, ctx: Context) => {
      const out = new Instance();
      out.instanceId = instance.InstanceId;
      // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/hibernating-instances.html
      if (instance.StateReason?.Code === 'UserInitiatedHibernate') out.state = State.HIBERNATED;
      else if (instance.State === 'stopped') out.state = State.STOPPED
      // map interim states to running
      else out.state = State.RUNNING;
      out.hibernatable = instance.HibernationOptions?.Configured ?? false;
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
    instanceEqReplaceableFields: (a: Instance, b: Instance) => Object.is(a.instanceId, b.instanceId) &&
      Object.is(a.ami, b.ami) &&
      Object.is(a.instanceType, b.instanceType) &&
      Object.is(a.keyPairName, b.keyPairName) &&
      Object.is(a.hibernatable, b.hibernatable) &&
      Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
      a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))),
    instanceEqTags: (a: Instance, b: Instance) => Object.is(Object.keys(a.tags ?? {})?.length, Object.keys(b.tags ?? {})?.length) &&
      Object.keys(a.tags ?? {})?.every(ak => (a.tags ?? {})[ak] === (b.tags ?? {})[ak])
  },
  mappers: {
    instance: new Mapper<Instance>({
      entity: Instance,
      equals: (a: Instance, b: Instance) => Object.is(a.state, b.state) &&
        AwsEc2Module.utils.instanceEqReplaceableFields(a, b) &&
        AwsEc2Module.utils.instanceEqTags(a, b),
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
                instance.hibernatable,
                instance.keyPairName ?? '',
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
        updateOrReplace: (prev: Instance, next: Instance) =>  'replace',
        update: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Instance?.[e.instanceId ?? ''];
            if (!AwsEc2Module.utils.instanceEqReplaceableFields(e, cloudRecord)) {
              const insId = e.instanceId as string;
              if (!AwsEc2Module.utils.instanceEqTags(e, cloudRecord) && e.instanceId && e.tags) {
                await client.updateTags(insId, e.tags);
              }
              if (!Object.is(e.state, cloudRecord.state) && e.instanceId) {
                if (cloudRecord.state === State.STOPPED && e.state === State.RUNNING) {
                  await client.startInstance(insId);
                } else if (cloudRecord.state === State.RUNNING && e.state === State.HIBERNATED) {
                  await client.stopInstance(insId, true);
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
  },
}, __dirname);