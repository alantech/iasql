import { Instance as InstanceAWS, } from '@aws-sdk/client-ec2'

import * as allEntities from './entity'
import { Instance, } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group@0.0.1'
import { AWS, IASQL_EC2_TAG_NAME } from '../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import * as metadata from './module.json'

export const AwsEc2Module: Module = new Module({
  ...metadata,
  provides: {
    entities: allEntities,
    tables: [
      'instance', 'instance_security_groups',
    ],
  },
  utils: {
    instanceMapper: async (instance: InstanceAWS, ctx: Context) => {
      const out = new Instance();
      out.instanceId = instance.InstanceId;
      // for instances created outside IaSQL, set the name to the instance ID
      out.name = instance.Tags?.filter(t => t.Key === IASQL_EC2_TAG_NAME && t.Value !== undefined).pop()?.Value ?? (instance.InstanceId ?? '');
      out.ami = instance.ImageId ?? '';
      out.instanceType = instance.InstanceType ?? '';
      if (!out.instanceType) throw new Error('Cannot create Instance object without a valid InstanceType in the Database');
      out.securityGroups = await AwsSecurityGroupModule.mappers.securityGroup.db.read(
        ctx,
        instance.SecurityGroups?.map(sg => sg.GroupId).filter(id => !!id) as string[],
      );
      return out;
    },
  },
  mappers: {
    instance: new Mapper<Instance>({
      entity: Instance,
      entityPrint: (e: Instance) => ({
        name: e.name,
        id: e.id?.toString() ?? '',
        instanceId: e.instanceId ?? '',
        ami: e.ami ?? '',
        instanceType: e.instanceType ?? '',
        securityGroups: e.securityGroups?.map(sg => sg.groupName ?? '').join(', ') ?? '',
      }),
      equals: (a: Instance, b: Instance) => Object.is(a.name, b.name) &&
        Object.is(a.instanceId, b.instanceId) &&
        Object.is(a.ami, b.ami) &&
        Object.is(a.instanceType, b.instanceType) &&
        Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
        a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))),
      source: 'db',
      cloud: new Crud({
        create: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const instance of es) {
            if (instance.ami) {
              const instanceId = await client.newInstance(
                instance.name,
                instance.instanceType,
                instance.ami,
                instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[],
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
          const instances = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getInstance(id))) :
            (await client.getInstances()).Instances ?? [];
          // ignore instances in "Terminated" and "Shutting down" state
          return await Promise.all(instances
            .filter(i => i?.State?.Name !== "terminated" && i?.State?.Name !== "shutting-down")
            .map(i => AwsEc2Module.utils.instanceMapper(i, ctx))
          );
        },
        update: async (es: Instance[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Instance?.[e.instanceId ?? e.name];
            const created = AwsEc2Module.mappers.instance.cloud.create([e], ctx);
            await AwsEc2Module.mappers.instance.cloud.delete([cloudRecord], ctx);
            return created;
          }));
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