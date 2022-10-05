import { EC2, Subnet as AwsSubnet, paginateDescribeSubnets } from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { Subnet, SubnetState, Vpc } from '../entity';

export class SubnetMapper extends MapperBase<Subnet> {
  module: AwsVpcModule;
  entity = Subnet;
  equals = (a: Subnet, b: Subnet) =>
    Object.is(a.subnetId, b.subnetId) && Object.is(a?.availabilityZone?.name, b?.availabilityZone?.name); // TODO: Do better

  async subnetMapper(sn: AwsSubnet, ctx: Context, region: string) {
    const out = new Subnet();
    if (!sn?.SubnetId || !sn?.VpcId) return undefined;
    out.state = sn.State as SubnetState;
    if (!sn.AvailabilityZone) return undefined;
    out.availabilityZone =
      (await this.module.availabilityZone.db.read(ctx, `${sn.AvailabilityZone}|${region}`)) ??
      (await this.module.availabilityZone.cloud.read(ctx, `${sn.AvailabilityZone}|${region}`));
    out.vpc =
      (await this.module.vpc.db.read(ctx, `${sn.VpcId}|${region}`)) ??
      (await this.module.vpc.cloud.read(ctx, `${sn.VpcId}|${region}`));
    if (sn.VpcId && !out.vpc) throw new Error(`Waiting for VPC ${sn.VpcId}`);
    out.availableIpAddressCount = sn.AvailableIpAddressCount;
    out.cidrBlock = sn.CidrBlock;
    out.subnetId = sn.SubnetId;
    out.ownerId = sn.OwnerId;
    out.subnetArn = sn.SubnetArn;
    out.region = region;
    return out;
  }

  createSubnet = crudBuilder2<EC2, 'createSubnet'>('createSubnet', input => input);
  getSubnet = crudBuilderFormat<EC2, 'describeSubnets', AwsSubnet | undefined>(
    'describeSubnets',
    id => ({ SubnetIds: [id] }),
    res => res?.Subnets?.[0],
  );
  getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
  deleteSubnet = crudBuilder2<EC2, 'deleteSubnet'>('deleteSubnet', input => input);

  cloud: Crud2<Subnet> = new Crud2({
    create: async (es: Subnet[], ctx: Context) => {
      // TODO: Add support for creating default subnets (only one is allowed, also add
      // constraint that a single subnet is set as default)
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: any = {
          AvailabilityZone: e.availabilityZone.name,
          VpcId: e.vpc.vpcId,
        };
        if (e.cidrBlock) input.CidrBlock = e.cidrBlock;
        const res = await this.createSubnet(client.ec2client, input);
        if (res?.Subnet) {
          const newSubnet = await this.subnetMapper(res.Subnet, ctx, e.region);
          if (!newSubnet) continue;
          newSubnet.id = e.id;
          Object.keys(newSubnet).forEach(k => ((e as any)[k] = (newSubnet as any)[k]));
          await this.module.subnet.db.update(e, ctx);
          // TODO: What to do if no subnet returned?
        }
      }
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      // TODO: Convert AWS subnet representation to our own
      if (!!id) {
        const [subnetId, region] = id.split('|');
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawSubnet = await this.getSubnet(client.ec2client, subnetId);
          if (!rawSubnet) return;
          return await this.subnetMapper(rawSubnet, ctx, region);
        }
      } else {
        const out: Subnet[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const sn of await this.getSubnets(client.ec2client)) {
              const outSn = await this.subnetMapper(sn, ctx, region);
              if (outSn) out.push(outSn);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: Subnet[], ctx: Context) => {
      // There is no update mechanism for a subnet so instead we will create a new one and the
      // next loop through should delete the old one
      const out = await this.module.subnet.cloud.create(es, ctx);
      if (out instanceof Array) return out;
    },
    delete: async (es: Subnet[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Special behavior here. You're not allowed to mess with the "default" VPC or its subnets.
        // Any attempt to update it is instead turned into *restoring* the value in
        // the database to match the cloud value
        if (e.vpc?.isDefault) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          const vpc = ctx?.memo?.db?.Vpc[`${e.vpc.vpcId}|${e.vpc.region}`] ?? null;
          e.vpc.id = vpc.id;
          await this.module.subnet.db.update(e, ctx);
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.Subnet[this.entityId(e)] = e;
        } else {
          await this.deleteSubnet(client.ec2client, {
            SubnetId: e.subnetId,
          });
        }
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
