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
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsAccount1637177234221, } from './migration/1637177234221-aws_account'

export const AwsAccount: Module = new Module({
  name: 'aws_account',
  dependencies: [],
  provides: {
    entities: allEntities,
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
      out.availabilityZone = await AwsAccount.mappers.availabilityZone.db.read(ctx, sn.AvailabilityZone) ??
        await AwsAccount.mappers.availabilityZone.cloud.read(ctx, sn.AvailabilityZone);
      out.vpc = await AwsAccount.mappers.vpc.db.read(ctx, sn.VpcId) ??
        await AwsAccount.mappers.vpc.cloud.read(ctx, sn.VpcId);
      out.availableIpAddressCount = sn.AvailableIpAddressCount;
      out.cidrBlock = sn.CidrBlock;
      out.subnetId = sn.SubnetId;
      out.ownerId = sn.OwnerId;
      out.subnetArn = sn.SubnetArn;
      console.log({
        out,
      });
      return out;
    },
  },
  mappers: {
    awsAccount: new Mapper<AwsAccountEntity>({
      entity: AwsAccountEntity,
      entityId: (e: AwsAccountEntity) => e.id + '',
      entityPrint: (e: AwsAccountEntity) => ({
        id: e.id?.toString() ?? '',
        accessKeyId: e.accessKeyId ?? '',
        secretAccessKey: e.secretAccessKey ?? '',
        region: e?.region?.name ?? '',
      }),
      equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
      source: 'db',
      db: new Crud({
        create: (e: AwsAccountEntity[], ctx: Context) => ctx.orm.save(AwsAccountEntity, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AwsAccountEntity, ids ? {
          where: {
            id: In(ids),
          },
        } : undefined),
        update: (e: AwsAccountEntity[], ctx: Context) => ctx.orm.save(AwsAccountEntity, e),
        delete: (e: AwsAccountEntity[], ctx: Context) => ctx.orm.remove(AwsAccountEntity, e),
      }),
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        // TODO: Perhaps we should to validate the credentials as being valid?
        create: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AwsAccountEntity, ids ? {
          where: {
            id: In(ids),
          },
        } : undefined),
        update: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
    region: new Mapper<Region>({
      entity: Region,
      entityId: (e: Region) => e.name ?? '',
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: Region) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (a: Region, b: Region) => Object.is(a.endpoint, b.endpoint) &&
        Object.is(a.name, b.name) &&
        Object.is(a.optInStatus, b.optInStatus),
      source: 'cloud',
      db: new Crud({
        create: (e: Region[], ctx: Context) => ctx.orm.save(Region, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(Region, ids ? {
          where: {
            name: In(ids),
          },
        } : undefined),
        update: (e: Region[], ctx: Context) => ctx.orm.save(Region, e),
        delete: (e: Region[], ctx: Context) => ctx.orm.remove(Region, e),
      }),
      cloud: new Crud({
        create: async (e: Region[], ctx: Context) => {
          // If we detect regions in the DB that aren't in AWS, we should just remove them
          await AwsAccount.mappers.region.db.delete(e, ctx);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const rs = (await client.getRegions())?.Regions ?? [];
          return rs
            .filter(r => !ids || ids.includes(r?.RegionName ?? 'what'))
            .map(AwsAccount.utils.regionMapper);
        },
        update: async (e: Region[], ctx: Context) => {
          // Ideally, we just revert these records, but it is easier to delete and recreate in a
          // second pass
          await AwsAccount.mappers.region.db.delete(e, ctx);
        },
        delete: async (e: Region[], ctx: Context) => {
          // If we detect regions missing from the DB, we should just insert them
          await AwsAccount.mappers.region.db.create(e, ctx);
        },
      }),
    }),
    vpc: new Mapper<AwsVpc>({
      entity: AwsVpc,
      entityId: (e: AwsVpc) => e?.vpcId ?? '',
      entityPrint: (e: AwsVpc) => ({
        id: e.id?.toString() ?? '',
        vpcId: e.vpcId ?? '',
        cidrBlock: e.cidrBlock ?? '',
        isDefault: e.isDefault?.toString() ?? 'false',
        state: e?.state ?? VpcState.AVAILABLE, // TODO: What's the right "default" here?
      }),
      equals: (a: AwsVpc, b: AwsVpc) => Object.is(a.vpcId, b.vpcId) &&
        Object.is(a.cidrBlock, b.cidrBlock) &&
        Object.is(a.isDefault, b.isDefault) &&
        Object.is(a.state, b.state),
      source: 'db',
      db: new Crud({
        create: (e: AwsVpc[], ctx: Context) => ctx.orm.save(AwsVpc, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AwsVpc, ids ? {
          where: {
            vpcId: In(ids),
          },
        } : undefined),
        update: (vpc: AwsVpc[], ctx: Context) => ctx.orm.save(AwsVpc, vpc),
        delete: (e: AwsVpc[], ctx: Context) => ctx.orm.remove(AwsVpc, e),
      }),
      cloud: new Crud({
        create: async (vpc: AwsVpc[], ctx: Context) => { 
          // TODO: You can totally CRUD VPCs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/classes/createvpccommand.html
          // We need to figure out how to handle this
          await AwsAccount.mappers.vpc.db.delete(vpc, ctx);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const vpcs = Array.isArray(ids) ?
            await Promise.all(ids.map((id) => client.getVpc(id))) :
            (await client.getVpcs()).Vpcs;
          return await Promise.all(vpcs.map(vpc => AwsAccount.utils.vpcMapper(vpc, ctx)));
        },
        update: async (vpc: AwsVpc[], ctx: Context) => {
          // TODO: Handle this correctly in the future
          await AwsAccount.mappers.vpc.db.delete(vpc, ctx);
        },
        delete: async (vpc: AwsVpc[], ctx: Context) => {
          // TODO: Handle this correctly in the future
          await AwsAccount.mappers.vpc.db.create(vpc, ctx);
        },
      }),
    }),
    availabilityZone: new Mapper<AvailabilityZone>({
      entity: AvailabilityZone,
      entityId: (e: AvailabilityZone) => e.zoneName,
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: AvailabilityZone) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (a: AvailabilityZone, b: AvailabilityZone) => Object.is(a.zoneName, b.zoneName) &&
        Object.is(a.zoneId, b.zoneId) &&
        Object.is(a.groupName, b.groupName) &&
        Object.is(a.networkBorderGroup, b.networkBorderGroup) &&
        Object.is(a.optInStatus, b.optInStatus) &&
        // TODO: Restore this in the equality check when we can be sure the db sourced records
        // include the parentZone correctly (see below)
        // Object.is(a?.parentZone?.zoneName, b?.parentZone?.zoneName) &&
        Object.is(a.region.name, b.region.name) &&
        Object.is(a.state, b.state),
      source: 'cloud',
      db: new Crud({
        create: async (es: AvailabilityZone[], ctx: Context) => {
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
        // TODO: This needs to grab and attach the `parentZone` when defined to be correct, but
        // TypeORM cannot handle self-recursive entities properly, so we would have to do this by
        // hand
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AvailabilityZone, ids ? {
          where: {
            zoneName: In(ids),
          },
        } : undefined),
        update: async (es: AvailabilityZone[], ctx: Context) => {
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
        delete: (es: AvailabilityZone[], ctx: Context) => ctx.orm.remove(AvailabilityZone, es),
      }),
      cloud: new Crud({
        create: async (e: AvailabilityZone[], ctx: Context) => {
          // Availability Zones cannot be created by the user, so simply delete these from the DB
          await AwsAccount.mappers.availabilityZone.db.delete(e, ctx);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const regions = (await AwsAccount.mappers.region.cloud.read(ctx))
            .filter((r: Region) => r.optInStatus !== AvailabilityZoneOptInStatus.NOT_OPTED_IN);
          const regionNames = regions.map((r: Region) => r.name);
          const availabilityZones = await client.getAvailabilityZones(regionNames);
          // TODO: Can it be simplified https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/classes/createvpccommand.htmlfurther?
          if (ids) {
            const azs = availabilityZones.filter(az => ids.includes(az?.ZoneName ?? ''));
            // Linearized to make sure the nested parentAvailabilityZone and the outer reference
            // to the same object actually get the same object in memory so TypeORM doesn't do
            // a double insert
            return azs.map(az => AwsAccount.utils.azMapper(az, regions, availabilityZones));
          } else {
            // Linearized to make sure the nested parentAvailabilityZone and the outer reference
            // to the same object actually get the same object in memory so TypeORM doesn't do a
            // double insert
            return availabilityZones.map(
              az => AwsAccount.utils.azMapper(az, regions, availabilityZones)
            );
          }
        },
        update: async (e: AvailabilityZone[], ctx: Context) => {
          // Availability Zones cannot be changed, so delete these changes and the second pass will
          // restore the original state
          await AwsAccount.mappers.availabilityZone.db.delete(e, ctx);
        },
        delete: async (e: AvailabilityZone[], ctx: Context) => {
          // Availability Zones cannot be deleted, so restore these values into the DB
          await AwsAccount.mappers.availabilityZone.db.create(e, ctx);
        },
      }),
    }),
    availabilityZoneMessage: new Mapper<AvailabilityZoneMessage>({
      entity: AvailabilityZoneMessage,
      entityId: (e: AvailabilityZoneMessage) => e.availabilityZone.zoneName + e.message,
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: AvailabilityZoneMessage) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (_a: AvailabilityZoneMessage, _b: AvailabilityZoneMessage) => true, // TODO: Fill this in
      source: 'cloud',
      db: new Crud({
        create: (e: AvailabilityZoneMessage[], ctx: Context) => ctx
          .orm.save(AvailabilityZoneMessage, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AvailabilityZoneMessage, ids ? {
          where: {
            // TODO: How to split the ID between zoneName and message reliably?
            availabilityZone: {
              zoneName: In(ids),
            },
          },
        } : undefined),
        update: (e: AvailabilityZoneMessage[], ctx: Context) => ctx
          .orm.save(AvailabilityZoneMessage, e),
        delete: (e: AvailabilityZoneMessage[], ctx: Context) => ctx
          .orm.remove(AvailabilityZoneMessage, e),
      }),
      cloud: new Crud({
        create: async (e: AvailabilityZoneMessage[], ctx: Context) => {
          // Read-only table, restore it
          await AwsAccount.mappers.availabilityZoneMessage.db.delete(e, ctx);
        },
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AvailabilityZoneMessage, ids ? {
          where: {
            // TODO: How to split the ID between zoneName and message reliably?
            availabilityZone: {
              zoneName: In(ids),
            },
          },
        } : undefined),
        update: async (e: AvailabilityZoneMessage[], ctx: Context) => {
          // Read-only table, restore it
          await AwsAccount.mappers.availabilityZoneMessage.db.delete(e, ctx);
        },
        delete: async (e: AvailabilityZoneMessage[], ctx: Context) => {
          // Read-only table, restore it
          await AwsAccount.mappers.availabilityZoneMessage.db.create(e, ctx);
        },
      }),
    }),
    subnet: new Mapper<AwsSubnet>({
      entity: AwsSubnet,
      entityId: (e: AwsSubnet) => e.subnetId ?? '',
      entityPrint: (e: AwsSubnet) => ({
        id: e.id?.toString() ?? '',
        availabilityZone: e?.availabilityZone?.zoneName ?? '',
        availableIpAddressCount: e?.availableIpAddressCount?.toString() ?? '',
        cidrBlock: e?.cidrBlock ?? '',
        ownerId: e?.ownerId ?? '',
        state: e.state ?? SubnetState.AVAILABLE,
        subnetArn: e?.subnetArn ?? '',
        subnetId: e?.subnetId ?? '',
      }),
      equals: (a: AwsSubnet, b: AwsSubnet) => Object.is(a.subnetId, b.subnetId), // TODO: Improve
      source: 'db',
      db: new Crud({
        create: (e: AwsSubnet[], ctx: Context) => ctx.orm.save(AwsSubnet, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AwsSubnet, ids ? {
          where: {
            subnetId: In(ids),
          },
          relations: [ 'vpc', ],
        } : { relations: [ 'vpc', ], }),
        update: (sn: AwsSubnet[], ctx: Context) => ctx.orm.save(AwsSubnet, sn),
        delete: (e: AwsSubnet[], ctx: Context) => ctx.orm.remove(AwsSubnet, e),
      }),
      cloud: new Crud({
        create: async (sn: AwsSubnet[], ctx: Context) => {
          // TODO: Users can have custom subnets, add support for it: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/classes/createsubnetcommand.html
          await AwsAccount.mappers.subnet.db.delete(sn, ctx);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const subnets = ids === undefined ?
            (await client.getSubnets()).Subnets :
            await Promise.all(ids.map(id => client.getSubnet(id)));
          return await Promise.all(subnets.map(sn => AwsAccount.utils.subnetMapper(sn, ctx)));
        },
        update: async (sn: AwsSubnet[], ctx: Context) => {
          // TODO: Do the right thing
          await AwsAccount.mappers.subnet.db.delete(sn, ctx);
        },
        delete: async (sn: AwsSubnet[], ctx: Context) => {
          // TODO: Do the right thing
          await AwsAccount.mappers.subnet.db.create(sn, ctx);
          console.dir(ctx.memo, { depth: 4, });
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsAccount1637177234221.prototype.up,
    preremove: awsAccount1637177234221.prototype.down,
  },
});
