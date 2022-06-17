import {
  CreateNatGatewayCommandInput,
  NatGateway as AwsNatGateway,
  Subnet as AwsSubnet,
  Tag,
  Vpc as AwsVpc,
} from '@aws-sdk/client-ec2'

import { AWS, } from '../../../services/gateways/aws'
import {
  AvailabilityZone,
  Subnet,
  Vpc,
  SubnetState,
  VpcState,
  NatGateway,
  ConnectivityType,
  NatGatewayState,
  ElasticIp,
} from './entity'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsVpcModule: Module2 = new Module2({
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
    natGatewayMapper: async (nat: AwsNatGateway, ctx: Context) => {
      const out = new NatGateway();
      out.connectivityType = nat.ConnectivityType as ConnectivityType;
      const natPublicAddress = nat.NatGatewayAddresses?.filter(n => !!n.AllocationId).pop();
      if (natPublicAddress) {
        out.elasticIp = await AwsVpcModule.mappers.elasticIp.db.read(ctx, natPublicAddress.AllocationId) ??
          await AwsVpcModule.mappers.elasticIp.cloud.read(ctx, natPublicAddress.AllocationId);
        if (!out.elasticIp) throw new Error('Not valid elastic ip, yet?');
      }
      out.natGatewayId = nat.NatGatewayId;
      out.state = nat.State as NatGatewayState;
      out.subnet = await AwsVpcModule.mappers.subnet.db.read(ctx, nat.SubnetId) ??
        await AwsVpcModule.mappers.subnet.cloud.read(ctx, nat.SubnetId);
      if (nat.SubnetId && !out.subnet) return undefined;
      const tags: { [key: string]: string } = {};
      (nat.Tags || []).filter(t => !!t.Key && !!t.Value).forEach(t => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
      return out;
    },
    elasticIpMapper: (eip: any) => {
      const out = new ElasticIp();
      out.allocationId = eip.AllocationId;
      if (!out.allocationId) throw new Error('AWS should assign an AllocationId, this must not happen!');
      out.publicIp = eip.PublicIp;
      const tags: { [key: string]: string } = {};
      (eip.Tags || []).filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
      return out;
    },
    eqTags: (a: { [key: string]: string }, b: { [key: string]: string }) => Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
      Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak]),
  },
  mappers: {
    subnet: new Mapper2<Subnet>({
      entity: Subnet,
      equals: (a: Subnet, b: Subnet) => Object.is(a.subnetId, b.subnetId), // TODO: Do better
      source: 'db',
      cloud: new Crud2({
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
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          // TODO: Convert AWS subnet representation to our own
          if (!!id) {
            const rawSubnet = await client.getSubnet(id);
            if (!rawSubnet) return;
            return await AwsVpcModule.utils.subnetMapper(rawSubnet, ctx);
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
    vpc: new Mapper2<Vpc>({
      entity: Vpc,
      equals: (a: Vpc, b: Vpc) => Object.is(a.vpcId, b.vpcId), // TODO: Do better
      source: 'db',
      cloud: new Crud2({
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
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (!!id) {
            const rawVpc = await client.getVpc(id);
            if (!rawVpc) return;
            return AwsVpcModule.utils.vpcMapper(rawVpc);
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
    natGateway: new Mapper2<NatGateway>({
      entity: NatGateway,
      equals: (a: NatGateway, b: NatGateway) => Object.is(a.connectivityType, b.connectivityType)
        && Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId)
        && Object.is(a.state, b.state)
        && Object.is(a.subnet?.subnetArn, b.subnet?.subnetArn)
        && AwsVpcModule.utils.eqTags(a.tags, b.tags),
      source: 'db',
      cloud: new Crud2({
        create: async (es: NatGateway[], ctx: Context) => {
          const out = [];
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const input: CreateNatGatewayCommandInput = {
              SubnetId: e.subnet?.subnetId,
              ConnectivityType: e.connectivityType,
            };
            if (e.tags && Object.keys(e.tags).length) {
              const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
                return {
                  Key: k, Value: e.tags![k],
                }
              });
              input.TagSpecifications = [
                {
                  ResourceType: 'natgateway',
                  Tags: tags,
                },
              ]
            }
            if (e.elasticIp) {
              input.AllocationId = e.elasticIp.allocationId;
            } else if (!e.elasticIp && e.connectivityType === ConnectivityType.PUBLIC) {
              const elasticIp = new ElasticIp();
              // Attach the same tags in case we want to associate them visualy through the AWS Console
              elasticIp.tags = e.tags;
              const newElasticIp = await AwsVpcModule.mappers.elasticIp.cloud.create(elasticIp, ctx);
              input.AllocationId = newElasticIp.allocationId;
            }
            const res: AwsNatGateway | undefined = await client.createNatGateway(input);
            if (res) {
              const newNatGateway = await AwsVpcModule.utils.natGatewayMapper(res, ctx);
              newNatGateway.id = e.id;
              await AwsVpcModule.mappers.natGateway.db.update(newNatGateway, ctx);
              out.push(newNatGateway);
            }
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (!!id) {
            const rawNatGateway = await client.getNatGateway(id);
            if (!rawNatGateway) return;
            return await AwsVpcModule.utils.natGatewayMapper(rawNatGateway, ctx);
          } else {
            const out = [];
            for (const ng of (await client.getNatGateways())) {
              out.push(await AwsVpcModule.utils.natGatewayMapper(ng, ctx));
            }
            return out;
          }
        },
        updateOrReplace: (a: NatGateway, b: NatGateway) => {
          if (!(Object.is(a.state, b.state) && AwsVpcModule.utils.eqTags(a.tags, b.tags))
            && Object.is(a.connectivityType, b.connectivityType)
            && Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId)
            && Object.is(a.subnet?.subnetId, b.subnet?.subnetId)) return 'update';
          return 'replace';
        },
        update: async (es: NatGateway[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.NatGateway?.[e.natGatewayId ?? ''];
            const isUpdate = Object.is(AwsVpcModule.mappers.natGateway.cloud.updateOrReplace(cloudRecord, e), 'update');
            if (isUpdate) {
              if (!AwsVpcModule.utils.eqTags(cloudRecord.tags, e.tags)) {
                await client.updateTags(e.natGatewayId ?? '', e.tags);
                const rawNatGateway = await client.getNatGateway(e.natGatewayId ?? '');
                const updatedNatGateway = await AwsVpcModule.utils.natGatewayMapper(rawNatGateway, ctx);
                updatedNatGateway.id = e.id;
                await AwsVpcModule.mappers.natGateway.db.update(updatedNatGateway, ctx);
                out.push(updatedNatGateway);
                continue;
              }
              cloudRecord.id = e.id;
              await AwsVpcModule.mappers.natGateway.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
              continue;
            }
            // Need to delete first to make the elastic ip address available
            await AwsVpcModule.mappers.natGateway.cloud.delete(cloudRecord, ctx);
            const newNatGateway = await AwsVpcModule.mappers.natGateway.cloud.create(e, ctx);
            out.push(newNatGateway);
          }
          return out;
        },
        delete: async (es: NatGateway[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteNatGateway(e.natGatewayId ?? '');
          }
        },
      }),
    }),
    elasticIp: new Mapper2<ElasticIp>({
      entity: ElasticIp,
      equals: (a: ElasticIp, b: ElasticIp) => Object.is(a.publicIp, b.publicIp)
        && AwsVpcModule.utils.eqTags(a.tags, b.tags),
      source: 'db',
      cloud: new Crud2({
        create: async (es: ElasticIp[], ctx: Context) => {
          const out = [];
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const res = await client.createElasticIp(e.tags);
            const rawElasticIp = await client.getElasticIp(res.AllocationId ?? '');
            const newElasticIp = AwsVpcModule.utils.elasticIpMapper(rawElasticIp);
            newElasticIp.id = e.id;
            await AwsVpcModule.mappers.elasticIp.db.update(newElasticIp, ctx);
            out.push(newElasticIp);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (!!id) {
            const rawElasticIp = await client.getElasticIp(id);
            if (!rawElasticIp) return;
            return AwsVpcModule.utils.elasticIpMapper(rawElasticIp);
          } else {
            const out = [];
            for (const eip of (await client.getElasticIps())) {
              out.push(AwsVpcModule.utils.elasticIpMapper(eip));
            }
            return out;
          }
        },
        update: async (es: ElasticIp[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          // Elastic ip properties cannot be updated other than tags.
          // If the public ip is updated we just restor it
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.ElasticIp?.[e.allocationId ?? ''];
            if (e.tags && !AwsVpcModule.utils.eqTags(cloudRecord.tags, e.tags)) {
              await client.updateTags(e.allocationId ?? '', e.tags);
              const rawElasticIp = await client.getElasticIp(e.allocationId ?? '');
              const newElasticIp = AwsVpcModule.utils.elasticIpMapper(rawElasticIp);
              newElasticIp.id = e.id;
              await AwsVpcModule.mappers.elasticIp.db.update(newElasticIp, ctx);
              // Push
              out.push(newElasticIp);
              continue;
            }
            cloudRecord.id = e.id;
            await AwsVpcModule.mappers.elasticIp.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
          return out;
        },
        delete: async (es: ElasticIp[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteElasticIp(e.allocationId ?? '');
          }
        },
      }),
    }),
  },
}, __dirname)
