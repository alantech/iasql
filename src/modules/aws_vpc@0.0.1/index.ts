import { In, } from 'typeorm'
import { Subnet, Vpc, } from '@aws-sdk/client-ec2'

import { AWS, } from '../../services/gateways/aws'
import {
  AvailabilityZone,
  AwsSubnet,
  AwsVpc,
  SubnetState,
  VpcState,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsVpc1645805825036, } from './migration/1645805825036-aws_vpc'

export const AwsVpcModule: Module = new Module({
  name: 'aws_vpc',
  version: '0.0.1',
  dependencies: ['aws_account@0.0.1'],
  provides: {
    entities: allEntities,
    tables: ['aws_subnet', 'aws_vpc'],
  },
  utils: {
    subnetMapper: async (sn: Subnet, ctx: Context) => {
      const out = new AwsSubnet();
      if (!sn?.SubnetId || !sn?.VpcId) {
        throw new Error('Subnet not defined properly');
      }
      out.state = sn.State as SubnetState;
      out.availabilityZone = (sn.AvailabilityZone ?? '') as AvailabilityZone;
      out.vpc = await AwsVpcModule.mappers.vpc.db.read(ctx, sn.VpcId) ??
        await AwsVpcModule.mappers.vpc.cloud.read(ctx, sn.VpcId);
      out.availableIpAddressCount = sn.AvailableIpAddressCount;
      out.cidrBlock = sn.CidrBlock;
      out.subnetId = sn.SubnetId;
      out.ownerId = sn.OwnerId;
      out.subnetArn = sn.SubnetArn;
      return out;
    },
    vpcMapper: (vpc: Vpc) => {
      const out = new AwsVpc();
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
    subnet: new Mapper<AwsSubnet>({
      entity: AwsSubnet,
      entityId: (e: AwsSubnet) => e.subnetId ?? e.id.toString(),
      entityPrint: (e: AwsSubnet) => JSON.parse(JSON.stringify(e)),
      equals: (a: AwsSubnet, b: AwsSubnet) => Object.is(a.subnetId, b.subnetId), // TODO: Do better
      source: 'db',
      db: new Crud({
        create: (es: AwsSubnet[], ctx: Context) => ctx.orm.save(AwsSubnet, es),
        read: async (ctx: Context, ids?: string[]) => {
          const opts = ids ? {
            where: {
              subnetId: In(ids),
            },
          } : {};
          return await ctx.orm.find(AwsSubnet, opts);
        },
        update: (es: AwsSubnet[], ctx: Context) => ctx.orm.save(AwsSubnet, es),
        delete: (es: AwsSubnet[], ctx: Context) => ctx.orm.remove(AwsSubnet, es),
      }),
      cloud: new Crud({
        create: async (es: AwsSubnet[], ctx: Context) => {
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
        update: async (es: AwsSubnet[], ctx: Context) => {
          // There is no update mechanism for a subnet so instead we will create a new one and the
          // next loop through should delete the old one
          return await AwsVpcModule.mappers.subnet.cloud.create(es, ctx);
        },
        delete: async (es: AwsSubnet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteSubnet({
              SubnetId: e.subnetId,
            });
          }
        },
      }),
    }),
    vpc: new Mapper<AwsVpc>({
      entity: AwsVpc,
      entityId: (e: AwsVpc) => e.vpcId ?? e.id.toString(),
      entityPrint: (e: AwsVpc) => JSON.parse(JSON.stringify(e)),
      equals: (a: AwsVpc, b: AwsVpc) => Object.is(a.vpcId, b.vpcId), // TODO: Do better
      source: 'db',
      db: new Crud({
        create: (es: AwsVpc[], ctx: Context) => ctx.orm.save(AwsVpc, es),
        read: async (ctx: Context, ids?: string[]) => {
          const opts = ids ? {
            where: {
              vpcId: In(ids),
            },
          } : {};
          return await ctx.orm.find(AwsVpc, opts);
        },
        update: (es: AwsVpc[], ctx: Context) => ctx.orm.save(AwsVpc, es),
        delete: (es: AwsVpc[], ctx: Context) => ctx.orm.remove(AwsVpc, es),
      }),
      cloud: new Crud({
        create: async (es: AwsVpc[], ctx: Context) => {
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
        update: async (es: AwsVpc[], ctx: Context) => {
          // There is no update mechanism for a VPC's CIDR block (the only thing we can really
          // change) so instead we will create a new one and the next loop through should delete
          // the old one
          return await AwsVpcModule.mappers.vpc.cloud.create(es, ctx);
        },
        delete: async (es: AwsVpc[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteVpc({
              VpcId: e.vpcId,
            });
          }
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsVpc1645805825036.prototype.up,
    preremove: awsVpc1645805825036.prototype.down,
  },
})
