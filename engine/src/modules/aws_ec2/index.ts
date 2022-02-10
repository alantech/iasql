import { Instance as InstanceAWS, } from '@aws-sdk/client-ec2'
import { In, } from 'typeorm'

import * as allEntities from './entity'
import { Instance, } from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS, } from '../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21644465928055 } from './migration/1644465928055-aws_ec2'

export const AwsEc2Module: Module = new Module({
  name: 'aws_ec2',
  dependencies: ['aws_account', 'aws_security_group'],
  provides: {
    entities: allEntities,
    tables: [
      'instance',
    ],
  },
  utils: {
    instanceMapper: async (instance: InstanceAWS, ctx: Context) => {
      const out = new Instance();
      out.instanceId = instance.InstanceId;
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
      // fallback to our id when the instance hasn't been created
      entityId: (i: Instance) => i.instanceId ?? (i.id?.toString() ?? ''),
      entityPrint: (e: Instance) => ({
        id: e.id?.toString() ?? '',
        instanceId: e.instanceId ?? '',
        ami: e.ami ?? '',
        instanceType: e.instanceType ?? '',
        securityGroups: e.securityGroups?.map(sg => sg.groupName ?? '').join(', '),
      }),
      equals: (a: Instance, b: Instance) => Object.is(a.instanceId, b.instanceId) &&
        Object.is(a.ami, b.ami) &&
        Object.is(a.instanceType, b.instanceType) &&
        Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
        a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))),
      source: 'db',
      db: new Crud({
        create: (e: Instance[], ctx: Context) => ctx.orm.save(Instance, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(Instance, ids ? {
          where: {
            instanceId: In(ids),
          },
        } : undefined),
        update: (e: Instance[], ctx: Context) => ctx.orm.save(Instance, e),
        delete: (e: Instance[], ctx: Context) => ctx.orm.remove(Instance, e),
      }),
      cloud: new Crud({
        create: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const instance of es) {
            if (instance.ami) {
              const instanceId = await client.newInstance(
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
        // The second pass should remove the old instances
        update: (e: Instance[], ctx: Context) => AwsEc2Module.mappers.instance.cloud.create(e, ctx),
        delete: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const entity of es) {
            if (entity.instanceId) await client.terminateInstance(entity.instanceId);
          }
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEc21644465928055.prototype.up,
    preremove: awsEc21644465928055.prototype.down,
  },
});