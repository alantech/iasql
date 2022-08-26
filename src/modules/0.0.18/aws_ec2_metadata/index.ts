import {
  EC2,
  Instance as AWSInstance,
  InstanceTypeInfo,
  paginateDescribeInstances,
} from '@aws-sdk/client-ec2';

import { awsEc2Module } from '../aws_ec2';
import { Architecture, InstanceMetadata, RootDeviceType } from './entity';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';

class InstanceMetadataMapper extends MapperBase<InstanceMetadata> {
  module: AwsEc2MetadataModule;
  entity = InstanceMetadata;
  equals = (a: InstanceMetadata, b: InstanceMetadata) =>
    Object.is(a.id, b.id) &&
    Object.is(a.instanceId, b.instanceId) &&
    Object.is(a.architecture, b.architecture) &&
    // https://stackabuse.com/compare-two-dates-in-javascript/
    !(a.launchTime > b.launchTime) &&
    !(a.launchTime < b.launchTime) &&
    Object.is(a.cpuCores, b.cpuCores) &&
    Object.is(a.memSizeMB, b.memSizeMB);
  source: 'db' | 'cloud' = 'cloud';

  async instanceMetadataMapper(instance: AWSInstance, ctx: Context) {
    const client = (await ctx.getAwsClient()) as AWS;
    const out = new InstanceMetadata();
    if (!instance.InstanceId) return undefined;
    out.instanceId = instance.InstanceId;
    // fill join column which is the id from the `instance` table
    const ins = await awsEc2Module.instance.db.read(ctx, out.instanceId);
    out.id = ins.id;
    out.architecture = instance.Architecture as Architecture;
    if (!instance.PrivateIpAddress) return undefined;
    out.privateIpAddress = instance.PrivateIpAddress;
    out.launchTime = instance.LaunchTime as Date;
    out.cpuCores = instance.CpuOptions?.CoreCount as number;
    if (!instance.InstanceType) return undefined;
    const instanceType = await this.getInstanceType(client.ec2client, instance.InstanceType);
    out.memSizeMB = instanceType?.MemoryInfo?.SizeInMiB as number;
    out.ebsOptimized = instance.EbsOptimized ?? false;
    out.rootDeviceName = instance.RootDeviceName ?? '';
    out.rootDeviceType = (instance.RootDeviceType as RootDeviceType) ?? RootDeviceType.EBS;
    return out;
  }

  getInstanceType = crudBuilderFormat<EC2, 'describeInstanceTypes', InstanceTypeInfo | undefined>(
    'describeInstanceTypes',
    instanceType => ({ InstanceTypes: [instanceType] }),
    res => res?.InstanceTypes?.[0],
  );
  describeInstances = crudBuilder2<EC2, 'describeInstances'>('describeInstances', InstanceIds => ({
    InstanceIds,
  }));
  getInstance = async (client: EC2, id: string) => {
    const reservations = await this.describeInstances(client, [id]);
    return (reservations?.Reservations?.map((r: any) => r.Instances) ?? []).pop()?.pop();
  };
  getInstances = paginateBuilder<EC2>(paginateDescribeInstances, 'Instances', 'Reservations');

  cloud = new Crud2({
    // tslint:disable-next-line: no-empty
    create: async (_es: InstanceMetadata[], _ctx: Context) => {},
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawInstance = await this.getInstance(client.ec2client, id);
        if (!rawInstance) return;
        if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down') return;
        return await this.instanceMetadataMapper(rawInstance, ctx);
      } else {
        const rawInstances = (await this.getInstances(client.ec2client)) ?? [];
        const out = [];
        for (const i of rawInstances) {
          if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
          const outInst = await this.instanceMetadataMapper(i, ctx);
          if (outInst) out.push(outInst);
        }
        return out;
      }
    },
    // tslint:disable-next-line: no-empty
    update: async (_es: InstanceMetadata[], _ctx: Context) => {},
    // tslint:disable-next-line: no-empty
    delete: async (_es: InstanceMetadata[], _ctx: Context) => {},
  });

  constructor(module: AwsEc2MetadataModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsEc2MetadataModule extends ModuleBase {
  instanceMetadata: InstanceMetadataMapper;

  constructor() {
    super();
    this.instanceMetadata = new InstanceMetadataMapper(this);
    super.init();
  }
}
export const awsEc2MetadataModule = new AwsEc2MetadataModule();
