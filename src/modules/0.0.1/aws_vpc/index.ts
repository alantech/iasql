import { Subnet as AwsSubnet, Vpc as AwsVpc, } from '@aws-sdk/client-ec2'
import { AWS, } from 'iasql/services/gateways/aws'
import { Context, Crud, Mapper, Module, } from 'iasql/modules'

import {
  AvailabilityZone,
  Subnet,
  Vpc,
  SubnetState,
  VpcState,
} from './entity'
import * as metadata from './module.json'

export const AwsVpcModule: Module = new Module({
  ...metadata,
  utils: {
    subnetMapper: async (sn: AwsSubnet, ctx: Context) => {
      const out = new Subnet();
      if (!sn?.SubnetId || !sn?.VpcId) {
        throw new Error('Subnet not defined properly');
      }
      out.state = sn.State as SubnetState;
      out.availabilityZone = (sn.AvailabilityZone ?? '') as AvailabilityZone;
      out.vpc = await AwsVpcModule.mappers.vpc.db.read(ctx, sn.VpcId) ??
        await AwsVpcModule.mappers.vpc.cloud.read(ctx, sn.VpcId);
      if (sn.VpcId && !out.vpc) throw new Error(`Waiting for VPC ${sn.VpcId}`);
      if (out.vpc && out.vpc.vpcId && !out.vpc.id) {
        await AwsVpcModule.mappers.vpc.db.create(out.vpc, ctx);
      }
      out.availableIpAddressCount = sn.AvailableIpAddressCount;
      out.cidrBlock = sn.CidrBlock;
      out.subnetId = sn.SubnetId;
      out.ownerId = sn.OwnerId;
      out.subnetArn = sn.SubnetArn;
      return out;
    },
    vpcMapper: (vpc: AwsVpc) => {
      const out = new Vpc();
      if (!vpc?.VpcId || !vpc?.CidrBlock) {
        throw new Error('VPC not defined properly');
      }
      out.vpcId = vpc.VpcId;
      out.cidrBlock = vpc.CidrBlock;
      out.state = vpc.State as VpcState;
      out.isDefault = vpc.IsDefault ?? false;
      return out;
    },
  },
  mappers: {
    subnet: new Mapper<Subnet>({
      entity: Subnet,
      equals: (a: Subnet, b: Subnet) => Object.is(a.subnetId, b.subnetId), // TODO: Do better
      source: 'db',
      cloud: new Crud({
        create: async (es: Subnet[], ctx: Context) => {
          // TODO: Add support for creating default subnets (only one is allowed, also add
          // constraint that a single subnet is set as default)
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const input: any = {
              AvailabilityZone: e.availabilityZone,
              VpcId: e.vpc.vpcId,
            };
            if (e.cidrBlock) input.CidrBlock = e.cidrBlock;
            const res = await client.createSubnet(input);
            if (res.Subnet) {
              const newSubnet = await AwsVpcModule.utils.subnetMapper(res.Subnet, ctx);
              newSubnet.id = e.id;
              Object.keys(newSubnet).forEach(k => (e as any)[k] = newSubnet[k]);
              await AwsVpcModule.mappers.subnet.db.update(e, ctx);
              // TODO: What to do if no subnet returned?
            }
          }
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          // TODO: Convert AWS subnet representation to our own
          if (!!ids) {
            const out = [];
            for (const id of ids) {
              out.push(await AwsVpcModule.utils.subnetMapper(await client.getSubnet(id), ctx));
            }
            return out;
          } else {
            const out = [];
            for (const sn of (await client.getSubnets()).Subnets) {
              out.push(await AwsVpcModule.utils.subnetMapper(sn, ctx));
            }
            return out;
          }
        },
        update: async (es: Subnet[], ctx: Context) => {
          // There is no update mechanism for a subnet so instead we will create a new one and the
          // next loop through should delete the old one
          return await AwsVpcModule.mappers.subnet.cloud.create(es, ctx);
        },
        delete: async (es: Subnet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            // Special behavior here. You're not allowed to mess with the "default" VPC or its subnets.
            // Any attempt to update it is instead turned into *restoring* the value in
            // the database to match the cloud value
            if (e.vpc?.isDefault) {
              // For delete, we have un-memoed the record, but the record passed in *is* the one
              // we're interested in, which makes it a bit simpler here
              const vpc = ctx?.memo?.db?.Vpc[e.vpc.vpcId ?? ''] ?? null;
              e.vpc.id = vpc.id;
              await AwsVpcModule.mappers.subnet.db.update(e, ctx);
              // Make absolutely sure it shows up in the memo
              ctx.memo.db.Subnet[e.subnetId ?? ''] = e;
            } else {
              await client.deleteSubnet({
                SubnetId: e.subnetId,
              });
            }
          }
        },
      }),
    }),
    vpc: new Mapper<Vpc>({
      entity: Vpc,
      equals: (a: Vpc, b: Vpc) => Object.is(a.vpcId, b.vpcId), // TODO: Do better
      source: 'db',
      cloud: new Crud({
        create: async (es: Vpc[], ctx: Context) => {
          // TODO: Add support for creating default VPCs (only one is allowed, also add constraint
          // that a single VPC is set as default)
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const res = await client.createVpc({
              CidrBlock: e.cidrBlock,
              // TODO: Lots of other VPC specifications to write, but we don't support yet
            });
            if (res.Vpc) {
              const newVpc = AwsVpcModule.utils.vpcMapper(res.Vpc);
              newVpc.id = e.id;
              Object.keys(newVpc).forEach(k => (e as any)[k] = newVpc[k]);
              await AwsVpcModule.mappers.vpc.db.update(e, ctx);
              // TODO: What to do if no VPC returned?
            }
          }
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (!!ids) {
            const out = [];
            for (const id of ids) {
              out.push(AwsVpcModule.utils.vpcMapper((await client.getVpc(id))));
            }
            return out;
          } else {
            return (await client.getVpcs())
              .Vpcs
              .map(vpc => AwsVpcModule.utils.vpcMapper(vpc));
          }
        },
        update: async (es: Vpc[], ctx: Context) => {
          // There is no update mechanism for a VPC's CIDR block (the only thing we can really
          // change) so instead we will create a new one and the next loop through should delete
          // the old one
          return await AwsVpcModule.mappers.vpc.cloud.create(es, ctx);
        },
        delete: async (es: Vpc[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            // Special behavior here. You're not allowed to mess with the "default" VPC.
            // Any attempt to update it is instead turned into *restoring* the value in
            // the database to match the cloud value
            if (e.isDefault) {
              // For delete, we have un-memoed the record, but the record passed in *is* the one
              // we're interested in, which makes it a bit simpler here
              await AwsVpcModule.mappers.vpc.db.update(e, ctx);
              // Make absolutely sure it shows up in the memo
              ctx.memo.db.Vpc[e.vpcId ?? ''] = e;
              const subnets = ctx?.memo?.cloud?.Subnet ?? [];
              const relevantSubnets = subnets.filter(
                (s: Subnet) => s.vpc.vpcId === e.vpcId
              );
              if (relevantSubnets.length > 0) {
                await AwsVpcModule.mappers.subnet.db.update(relevantSubnets, ctx);
              }
            } else {
              await client.deleteVpc({
                VpcId: e.vpcId,
              });
            }
          }
        },
      }),
    }),
  },
}, __dirname)
