import { Instance as AWSInstance } from '@aws-sdk/client-ec2'

import { AwsEc2Module, } from '../aws_ec2'
import { Architecture, InstanceMetadata } from './entity'
import { AWS } from '../../../services/gateways/aws'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsEc2MetadataModule: Module2 = new Module2({
  ...metadata,
  utils: {
    instanceMetadataMapper: async (instance: AWSInstance, ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = new InstanceMetadata();
      if (!instance.InstanceId) return undefined;
      out.instanceId = instance.InstanceId;
      // fill join column which is the id from the `instance` table
      const ins = await AwsEc2Module.mappers.instance.db.read(
        ctx,
        out.instanceId,
      );
      out.id = ins.id;
      out.architecture = instance.Architecture as Architecture;
      if (!instance.PrivateIpAddress) return undefined;
      out.privateIpAddress = instance.PrivateIpAddress;
      out.launchTime = instance.LaunchTime as Date;
      out.spot = instance.InstanceLifecycle === 'spot';
      out.cpuCores = instance.CpuOptions?.CoreCount as number;
      if (!instance.InstanceType) return undefined;
      const instanceType = await client.getInstanceType(instance.InstanceType);
      out.memSizeMB = instanceType?.MemoryInfo?.SizeInMiB as number;
      return out;
    },
  },
  mappers: {
    instanceMetadata: new Mapper2<InstanceMetadata>({
      entity: InstanceMetadata,
      equals: (a: InstanceMetadata, b: InstanceMetadata) => Object.is(a.id, b.id) &&
          Object.is(a.instanceId, b.instanceId) &&
          Object.is(a.architecture, b.architecture) &&
          // https://stackabuse.com/compare-two-dates-in-javascript/
          !(a.launchTime > b.launchTime) && !(a.launchTime < b.launchTime) &&
          Object.is(a.spot, b.spot) &&
          Object.is(a.cpuCores, b.cpuCores) &&
          Object.is(a.memSizeMB, b.memSizeMB),
      source: 'cloud',
      cloud: new Crud2({
        // tslint:disable-next-line: no-empty
        create: async (_es: InstanceMetadata[], _ctx: Context) => {},
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawInstance = await client.getInstance(id);
            if (!rawInstance) return;
            if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down') return;
            return AwsEc2MetadataModule.utils.instanceMetadataMapper(rawInstance, ctx);
          } else {
            const rawInstances = (await client.getInstances()).Instances ?? [];
            const out = [];
            for (const i of rawInstances) {
              if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
              out.push(await AwsEc2MetadataModule.utils.instanceMetadataMapper(i, ctx));
            }
            return out;
          }
        },
        // tslint:disable-next-line: no-empty
        update: async (_es: InstanceMetadata[], _ctx: Context) => {},
        // tslint:disable-next-line: no-empty
        delete: async (_es: InstanceMetadata[], _ctx: Context) => {},
      }),
    }),
  },
}, __dirname);