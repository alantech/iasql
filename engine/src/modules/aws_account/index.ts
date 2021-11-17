import { Subnet, Vpc, } from '@aws-sdk/client-ec2'

import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, AWSSubnet, AwsVpc, SubnetState, VpcState, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsAccount1637164047096, } from './migration/1637164047096-aws_account'
import { In } from 'typeorm'

export const AwsAccount: Module = new Module({
  name: 'aws_account',
  dependencies: [],
  provides: {
    tables: ['aws_account', 'aws_vpc', 'aws_subnet',],
    context: {
      // This function is `async function () {` instead of `async () => {` because that enables the
      // `this` keyword within the function based on the objec it is being called from, so the
      // `getAwsClient` function can access the correct `orm` object with the appropriate creds and
      // read out the right AWS creds and create an AWS client also attached to the current context,
      // which will be different for different users. WARNING: Explicitly trying to access via
      // `AwsAccount.provides.context.getAwsClient` would instead use the context *template* that is
      // global to the codebase.
      async getAwsClient() {
        if (this.awsClient) return this.awsClient;
        const awsCreds = await this.orm.findOne(AwsAccount.mappers.awsAccount.entity);
        this.awsClient = new AWS({
          region: awsCreds.region,
          credentials: {
            accessKeyId: awsCreds.accessKeyId,
            secretAccessKey: awsCreds.secretAccessKey,
          },
        });
        return this.awsClient;
      },
      awsClient: null, // Just reserving this name to guard against collisions between modules.
    },
  },
  utils: {
    vpcMapper: (vpc: Vpc, _ctx: Context) => {
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
    subnetMapper: async (sn: Subnet, ctx: Context) => {
      const out = new AWSSubnet();
      if (!sn?.SubnetId || !sn?.VpcId) {
      throw new Error('Subnet not defined properly');
      }
      out.state = sn.State as SubnetState;
      out.vpc = ctx.memo?.db?.AwsVpc?.[sn.VpcId] ?? await AwsAccount.mappers.vpc.cloud.read(ctx, sn.VpcId);
      out.availableIpAddressCount = sn.AvailableIpAddressCount;
      out.cidrBlock = sn.CidrBlock;
      out.subnetId = sn.SubnetId;
      out.ownerId = sn.OwnerId;
      out.subnetArn = sn.SubnetArn;
      return out;
    },
  },
  mappers: {
    awsAccount: new Mapper<AwsAccountEntity>({
      entity: AwsAccountEntity,
      entityId: (e: AwsAccountEntity) => e.region,
      equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
      source: 'db',
      db: new Crud({
        create: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsAccountEntity, options),
        update: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        delete: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.remove(AwsAccountEntity, e); },
      }),
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        // TODO: Perhaps we should to validate the credentials as being valid?
        create: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, options: any) => ctx.orm.find(AwsAccountEntity, options),
        update: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
    vpc: new Mapper<AwsVpc>({
      entity: AwsVpc,
      entityId: (e: AwsVpc) => e?.vpcId ?? '',
      equals: (_a: AwsVpc, _b: AwsVpc) => true, // Do not let vpc updates
      source: 'db',
      db: new Crud({
        create: async (e: AwsVpc | AwsVpc[], ctx: Context) => { await ctx.orm.save(AwsVpc, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AwsVpc, id ? {
            where: {
              vpcId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          return out;
        },
        update: async (vpc: AwsVpc | AwsVpc[], ctx: Context) => {
          const es = Array.isArray(vpc) ? vpc : [vpc];
          await ctx.orm.save(AwsVpc, es);
        },
        delete: async (e: AwsVpc | AwsVpc[], ctx: Context) => { await ctx.orm.remove(AwsVpc, e); },
      }),
      cloud: new Crud({
        create: async (_vpc: AwsVpc | AwsVpc[], _ctx: Context) => { throw new Error('tbd'); },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsAccount.utils.vpcMapper(
                  await client.getVpc(id), ctx
                );
              }));
            } else {
              return await AwsAccount.utils.vpcMapper(
                await client.getVpc(ids), ctx
              );
            }
          } else {
            const result = await client.getVpcs();
            return await Promise.all(result.Vpcs.map((vpc: any) => AwsAccount.utils.vpcMapper(vpc, ctx)));
          }
        },
        update: async (_vpc: AwsVpc | AwsVpc[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (_vpc: AwsVpc | AwsVpc[], _ctx: Context) => { throw new Error('tbd'); },
      }),
    }),
    subnet: new Mapper<AWSSubnet>({
      entity: AWSSubnet,
      entityId: (e: AWSSubnet) => e?.subnetId ?? '',
      equals: (_a: AWSSubnet, _b: AWSSubnet) => true, // Do not let vpc updates
      source: 'db',
      db: new Crud({
        create: async (e: AWSSubnet | AWSSubnet[], ctx: Context) => { await ctx.orm.save(AWSSubnet, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AWSSubnet, id ? {
            where: {
              subnetId: Array.isArray(id) ? In(id) : id,
            },
            relations: ['vpc'],
          } : { relations: ['vpc'], });
          return out;
        },
        update: async (sn: AWSSubnet | AWSSubnet[], ctx: Context) => {
          const es = Array.isArray(sn) ? sn : [sn];
          await ctx.orm.save(AWSSubnet, es);
        },
        delete: async (e: AWSSubnet | AWSSubnet[], ctx: Context) => { await ctx.orm.remove(AWSSubnet, e); },
      }),
      cloud: new Crud({
        create: async (_sn: AWSSubnet | AWSSubnet[], _ctx: Context) => { throw new Error('tbd'); },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsAccount.utils.subnetMapper(
                  await client.getSubnet(id), ctx
                );
              }));
            } else {
              return await AwsAccount.utils.subnetMapper(
                await client.getSubnet(ids), ctx
              );
            }
          } else {
            const result = await client.getSubnets();
            return await Promise.all(result.Subnets.map((sn: any) => AwsAccount.utils.subnetMapper(sn, ctx)));
          }
        },
        update: async (_sn: AWSSubnet | AWSSubnet[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (_sn: AWSSubnet | AWSSubnet[], _ctx: Context) => { throw new Error('tbd'); },
      }),
    }),
  },
  migrations: {
    postinstall: awsAccount1637164047096.prototype.up,
    preremove: awsAccount1637164047096.prototype.down,
  },
});
