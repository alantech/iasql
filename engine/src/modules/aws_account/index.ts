import { In, } from 'typeorm'
import { Subnet, Vpc, } from '@aws-sdk/client-ec2'

import { AWS, } from '../../services/gateways/aws'
import {
  AvailabilityZone,
  AvailabilityZoneMessage,
  AvailabilityZoneOptInStatus,
  AvailabilityZoneState,
  AwsAccountEntity,
  AwsSubnet,
  AwsVpc,
  Region,
  VpcState,
  SubnetState,
} from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsAccount1637177234221, } from './migration/1637177234221-aws_account'

export const AwsAccount: Module = new Module({
  name: 'aws_account',
  dependencies: [],
  provides: {
    tables: [
      'availability_zone',
      'availability_zone_message',
      'aws_account',
      'aws_subnet',
      'aws_vpc',
      'region',
    ],
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
          region: awsCreds.region.name,
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
    regionMapper: (r: any) => {
      const out = new Region();
      out.endpoint = r?.Endpoint;
      out.name = r?.RegionName;
      out.optInStatus = r?.OptInStatus;
      return out;
    },
    azMapper: (az: any, regions: Region[], azs: any[]) => {
      const out = new AvailabilityZone();
      out.state = (az?.State ?? AvailabilityZoneState.AVAILABLE) as AvailabilityZoneState;
      out.optInStatus = (az?.OptInStatus ?? AvailabilityZoneOptInStatus.OPT_IN_NOT_REQUIRED) as AvailabilityZoneOptInStatus;
      out.messages = az?.Messages?.map((azm: any) => AwsAccount.utils.azmMapper(azm, out)) ?? [];
      out.region = regions.find((r: Region) => r.name === az.RegionName) as Region;
      out.zoneName = az.ZoneName ?? '';
      out.zoneId = az.ZoneId ?? '';
      out.groupName = az.GroupName ?? '';
      out.networkBorderGroup = az.NetworkBorderGroup ?? '';
      out.parentZone = az.ParentZoneName ? AwsAccount.utils.azMapper(
        azs.find((a: any) => az.ParentZoneName === a.ZoneName),
        regions,
        azs
      ) : undefined;
      return out;
    },
    azmMapper: (azm: any, az: AvailabilityZone) => {
      const out = new AvailabilityZoneMessage();
      out.message = azm.Message;
      out.availabilityZone = az;
      return out;
    },
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
      const out = new AwsSubnet();
      if (!sn?.SubnetId || !sn?.VpcId) {
        throw new Error('Subnet not defined properly');
      }
      out.state = sn.State as SubnetState;
      out.availabilityZone = ctx.memo?.db?.AvailabilityZone?.[sn?.AvailabilityZone ?? ''] ??
        await AwsAccount.mappers.availabilityZone.cloud.read(ctx, sn.AvailabilityZone);
      out.vpc = ctx.memo?.db?.AwsVpc?.[sn.VpcId] ??
        await AwsAccount.mappers.vpc.cloud.read(ctx, sn.VpcId);
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
      entityId: (e: AwsAccountEntity) => e.id + '',
      equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
      source: 'db',
      db: new Crud({
        create: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          return await ctx.orm.find(AwsAccountEntity, id ? {
            where: {
              id: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
        },
        update: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        delete: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.remove(AwsAccountEntity, e); },
      }),
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        // TODO: Perhaps we should to validate the credentials as being valid?
        create: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          return await ctx.orm.find(AwsAccountEntity, id ? {
            where: {
              id: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
        },
        update: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
    region: new Mapper<Region>({
      entity: Region,
      entityId: (e: Region) => e.name ?? '',
      equals: (a: Region, b: Region) => Object.is(a.endpoint, b.endpoint) &&
        Object.is(a.name, b.name) &&
        Object.is(a.optInStatus, b.optInStatus),
      source: 'cloud',
      db: new Crud({
        create: async (e: Region | Region[], ctx: Context) => { await ctx.orm.save(Region, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          return await ctx.orm.find(Region, id ? {
            where: {
              name: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
        },
        update: async (e: Region | Region[], ctx: Context) => { await ctx.orm.save(Region, e); },
        delete: async (e: Region | Region[], ctx: Context) => { await ctx.orm.remove(Region, e); },
      }),
      cloud: new Crud({
        create: async (_e: Region | Region[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids && !Array.isArray(ids)) {
            const r = await client.getRegion(ids);
            return AwsAccount.utils.regionMapper(r);
          }
          const rs = (await client.getRegions())?.Regions ?? [];
          const out = rs
            .filter(r => !Array.isArray(ids) || ids.includes(r?.RegionName ?? 'what'))
            .map(AwsAccount.utils.regionMapper);
          return out;
        },
        update: async (_e: Region | Region[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: Region | Region[], _ctx: Context) => { /* Do nothing */ },
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
          const opts = id ? {
            where: {
              vpcId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined;
          return (Array.isArray(id) || !opts) ? await ctx.orm.find(AwsVpc, opts) : await ctx.orm.findOne(AwsVpc, opts);
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
    availabilityZone: new Mapper<AvailabilityZone>({
      entity: AvailabilityZone,
      entityId: (e: AvailabilityZone) => e.zoneName,
      equals: (a: AvailabilityZone, b: AvailabilityZone) => Object.is(a.zoneName, b.zoneName) &&
        Object.is(a.zoneId, b.zoneId) &&
        Object.is(a.groupName, b.groupName) &&
        Object.is(a.networkBorderGroup, b.networkBorderGroup) &&
        Object.is(a.optInStatus, b.optInStatus) &&
        Object.is(a?.parentZone?.zoneName, b?.parentZone?.zoneName) &&
        Object.is(a.region.name, b.region.name) &&
        Object.is(a.state, b.state),
      source: 'cloud',
      db: new Crud({
        create: async (e: AvailabilityZone | AvailabilityZone[], ctx: Context) => {
          console.log('calling create');
          const es = Array.isArray(e) ? e : [e];
          for (const entity of es) {
            const azs = await ctx.orm.find(AvailabilityZone);
            if (entity.parentZone) {
              // Linter somehow thinks `az` is being shadowed when it isn't?
              const az1 = azs.find((a: any) => a.zoneName === entity?.parentZone?.zoneName);
              if (az1) entity.parentZone.id = az1.id;
              await ctx.orm.save(AvailabilityZone, entity.parentZone);
            }
            const az2 = azs.find((a: any) => a.zoneName === entity?.zoneName);
            if (az2) entity.id = az2.id;
            await ctx.orm.save(AvailabilityZone, entity);
          }
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AvailabilityZone, id ? {
            where: {
              zoneName: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          return out;
        },
        update: async (e: AvailabilityZone | AvailabilityZone[], ctx: Context) => {
          console.log('calling update');
          const es = Array.isArray(e) ? e : [e];
          for (const entity of es) {
            const azs = await ctx.orm.find(AvailabilityZone);
            if (entity.parentZone) {
              // Linter somehow thinks `az` is being shadowed when it isn't?
              const az1 = azs.find((a: any) => a.zoneName === entity?.parentZone?.zoneName);
              if (az1) entity.parentZone.id = az1.id;
              await ctx.orm.save(AvailabilityZone, entity.parentZone);
            }
            const az2 = azs.find((a: any) => a.zoneName === entity?.zoneName);
            if (az2) entity.id = az2.id;
            await ctx.orm.save(AvailabilityZone, entity);
          }
        },
        delete: async (e: AvailabilityZone | AvailabilityZone[], ctx: Context) => { await ctx.orm.remove(AvailabilityZone, e); },
      }),
      cloud: new Crud({
        create: async (_e: AvailabilityZone | AvailabilityZone[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, ids?: string | string[]) => {
          console.log('Calling cloud read...');
          const client = await ctx.getAwsClient() as AWS;
          const regions = (await AwsAccount.mappers.region.db.read(ctx))
            .filter((r: Region) => r.optInStatus !== AvailabilityZoneOptInStatus.NOT_OPTED_IN);
          const regionNames = regions.map((r: Region) => r.name);
          const availabilityZones = await client.getAvailabilityZones(regionNames);
          if (ids) {
            if (Array.isArray(ids)) {
              const azs = availabilityZones.filter(az => ids.includes(az?.ZoneName ?? ''));
              // Linearized to make sure the nested parentAvailabilityZone and the outer reference
              // to the same object actually get the same object in memory so TypeORM doesn't do
              // a double insert
              return azs.map(az => AwsAccount.utils.azMapper(az, regions, availabilityZones));
            } else {
              return AwsAccount.utils.azMapper(
                availabilityZones.find(az => ids === az?.ZoneName ?? ''),
                regions,
                availabilityZones,
              );
            }
          } else {
            // Linearized to make sure the nested parentAvailabilityZone and the outer reference
            // to the same object actually get the same object in memory so TypeORM doesn't do a
            // double insert
            return availabilityZones.map(
              az => AwsAccount.utils.azMapper(az, regions, availabilityZones)
            );
          }
        },
        update: async (_e: AvailabilityZone | AvailabilityZone[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AvailabilityZone | AvailabilityZone[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
    availabilityZoneMessage: new Mapper<AvailabilityZoneMessage>({
      entity: AvailabilityZoneMessage,
      entityId: (e: AvailabilityZoneMessage) => e.availabilityZone.zoneName + e.message,
      equals: (_a: AvailabilityZoneMessage, _b: AvailabilityZoneMessage) => true, // TODO: Fill this in
      source: 'cloud',
      db: new Crud({
        create: async (e: AvailabilityZoneMessage | AvailabilityZoneMessage[], ctx: Context) => { await ctx.orm.save(AvailabilityZoneMessage, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AvailabilityZoneMessage, id ? {
            where: {
              // TODO: How to split the ID between zoneName and message reliably?
              availabilityZone: {
                zoneName: Array.isArray(id) ? In(id) : id,
              },
            },
          } : undefined);
          return out;
        },
        update: async (e: AvailabilityZoneMessage | AvailabilityZoneMessage[], ctx: Context) => { await ctx.orm.save(AvailabilityZoneMessage, e); },
        delete: async (e: AvailabilityZoneMessage | AvailabilityZoneMessage[], ctx: Context) => { await ctx.orm.remove(AvailabilityZoneMessage, e); },
      }),
      cloud: new Crud({
        create: async (_e: AvailabilityZoneMessage | AvailabilityZoneMessage[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AvailabilityZoneMessage, id ? {
            where: {
              // TODO: How to split the ID between zoneName and message reliably?
              availabilityZone: {
                zoneName: Array.isArray(id) ? In(id) : id,
              },
            },
          } : undefined);
          return out;
        },
        update: async (_e: AvailabilityZoneMessage | AvailabilityZoneMessage[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AvailabilityZoneMessage | AvailabilityZoneMessage[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
    subnet: new Mapper<AwsSubnet>({
      entity: AwsSubnet,
      entityId: (e: AwsSubnet) => e?.subnetId ?? '',
      equals: (_a: AwsSubnet, _b: AwsSubnet) => true, // Do not let vpc updates
      source: 'db',
      db: new Crud({
        create: async (e: AwsSubnet | AwsSubnet[], ctx: Context) => { await ctx.orm.save(AwsSubnet, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['vpc',];
          if (!id || Array.isArray(id)) {
            return await ctx.orm.find(AwsSubnet, id ? {
              where: {
                subnetId: Array.isArray(id) ? In(id) : id,
              },
              relations,
            } : { relations });
          } else {
            return await ctx.orm.findOne(AwsSubnet, {
              where: {
                subnetId: Array.isArray(id) ? In(id) : id,
              },
              relations
            });
          }
        },
        update: async (sn: AwsSubnet | AwsSubnet[], ctx: Context) => {
          const es = Array.isArray(sn) ? sn : [sn];
          await ctx.orm.save(AwsSubnet, es);
        },
        delete: async (e: AwsSubnet | AwsSubnet[], ctx: Context) => { await ctx.orm.remove(AwsSubnet, e); },
      }),
      cloud: new Crud({
        create: async (_sn: AwsSubnet | AwsSubnet[], _ctx: Context) => { throw new Error('tbd'); },
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
        update: async (_sn: AwsSubnet | AwsSubnet[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (_sn: AwsSubnet | AwsSubnet[], _ctx: Context) => { throw new Error('tbd'); },
      }),
    }),
  },
  migrations: {
    postinstall: awsAccount1637177234221.prototype.up,
    preremove: awsAccount1637177234221.prototype.down,
  },
});
