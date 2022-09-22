import {
  SubnetGroup as AWSSubnetGroup,
  MemoryDB,
  UpdateSubnetGroupCommandInput,
} from '@aws-sdk/client-memorydb';

import { AwsMemoryDBModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsVpcModule } from '../../aws_vpc';
import { Subnet, Vpc } from '../../aws_vpc/entity';
import { SubnetGroup } from '../entity';
import supportedRegions from './supported_regions';

export class SubnetGroupMapper extends MapperBase<SubnetGroup> {
  module: AwsMemoryDBModule;
  entity = SubnetGroup;
  equals = (a: SubnetGroup, b: SubnetGroup) =>
    Object.is(a.description, b.description) &&
    Object.is(a.subnets?.length, b.subnets?.length) &&
    (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
    Object.is(a.region, b.region);

  async subnetGroupMapper(cloudE: AWSSubnetGroup, region: string) {
    const out = new SubnetGroup();
    if (!cloudE?.ARN || !cloudE?.Name) return undefined;
    out.arn = cloudE.ARN;
    out.subnetGroupName = cloudE.Name;
    out.description = cloudE.Description;
    const subnets = [];
    if (cloudE.Subnets?.length) {
      subnets.push(...cloudE.Subnets.map(sn => sn.Identifier ?? ''));
    }
    out.subnets = subnets;
    out.region = region;
    return out;
  }

  getSubnetGroupSubnets = crudBuilderFormat<MemoryDB, 'describeSubnetGroups', string[] | undefined>(
    'describeSubnetGroups',
    (SubnetGroupName: string) => ({ SubnetGroupName }),
    res => res?.SubnetGroups?.pop()?.Subnets?.map(sn => sn.Identifier ?? ''),
  );

  getSubnetGroup = crudBuilderFormat<MemoryDB, 'describeSubnetGroups', AWSSubnetGroup | undefined>(
    'describeSubnetGroups',
    (SubnetGroupName: string) => ({ SubnetGroupName }),
    res => res?.SubnetGroups?.pop(),
  );

  getSubnetGroups = crudBuilderFormat<MemoryDB, 'describeSubnetGroups', AWSSubnetGroup[] | undefined>(
    'describeSubnetGroups',
    () => ({}),
    res => res?.SubnetGroups,
  );

  createSubnetGroup = crudBuilder2<MemoryDB, 'createSubnetGroup'>('createSubnetGroup', input => input);

  getDefaultSubnets = async (ctx: Context, region: string): Promise<Subnet[]> => {
    const client = (await ctx.getAwsClient(region)) as AWS;
    // TODO: do this properly once vpc and subnets are multiregion
    const vpcs = [];
    for (const vpc of await awsVpcModule.vpc.getVpcs(client.ec2client)) {
      const outVpc = awsVpcModule.vpc.vpcMapper(vpc);
      if (outVpc) vpcs.push(outVpc);
    }
    const defaultVpc: Vpc | undefined =  vpcs.filter((vpc: Vpc) => vpc.isDefault).pop();
    const subnets: Subnet[] = [];
    for (const sn of await awsVpcModule.subnet.getSubnets(client.ec2client)) {
      const outSn = await awsVpcModule.subnet.subnetMapper(sn, ctx);
      if (outSn) subnets.push(outSn);
    }
    return subnets.filter(sn => sn.vpc.id === defaultVpc?.id);
  };

  updateSubnetGroup = crudBuilder2<MemoryDB, 'updateSubnetGroup'>('updateSubnetGroup', input => input);

  deleteSubnetGroup = crudBuilder2<MemoryDB, 'deleteSubnetGroup'>(
    'deleteSubnetGroup',
    (SubnetGroupName: string) => ({ SubnetGroupName }),
  );

  handleSubnetGroupCreateOrUpdate = async (
    action: 'create' | 'update',
    client: MemoryDB,
    ctx: Context,
    region: string,
    subnetGroupName: string,
    subnetIds: string[],
    description?: string,
    retry = 0,
  ) => {
    try {
      const input = {
        SubnetGroupName: subnetGroupName,
        SubnetIds: subnetIds,
        Description: description,
      };
      if (action === 'create') await this.createSubnetGroup(client, input);
      if (action === 'update') await this.updateSubnetGroup(client, input);
    } catch (e: any) {
      // This definetely depends too much on AWS and if they change the string any time this would not work,
      // but aws does not provide a way to know this info, and we should try to not throw the error when possible
      const relevantSubstring = 'Supported availability zones are [';
      if (retry < 3 && (e.message as string).lastIndexOf(relevantSubstring) !== -1) {
        const lastIndex = (e.message as string).length - 1;
        const azIndex = (e.message as string).lastIndexOf(relevantSubstring) + relevantSubstring.length;
        const allowedAzString = (e.message as string).substring(azIndex, lastIndex - 1);
        const allowedAz = allowedAzString.split(', ');
        const defaultSubnets = await this.getDefaultSubnets(ctx, region);
        const defaultSubnetsIds = defaultSubnets
          .filter(sn => allowedAz.includes(sn.availabilityZone.name))
          .map(sn => sn.subnetId ?? '');
        await this.handleSubnetGroupCreateOrUpdate(
          action,
          client,
          ctx,
          region,
          subnetGroupName,
          defaultSubnetsIds,
          description,
          retry + 1,
        );
      } else {
        throw e;
      }
    }
  };

  cloud: Crud2<SubnetGroup> = new Crud2({
    create: async (es: SubnetGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Create subnet group first
        let subnetIds: string[] = [];
        if (!e.subnets?.length) {
          const defaultSubnets = await this.getDefaultSubnets(ctx, e.region);
          subnetIds = defaultSubnets.map(sn => sn.subnetId ?? '');
        } else {
          subnetIds = e.subnets;
        }
        await this.handleSubnetGroupCreateOrUpdate(
          'create',
          client.memoryDBClient,
          ctx,
          e.region,
          e.subnetGroupName,
          subnetIds,
          e.description ?? undefined,
        );
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getSubnetGroup(client.memoryDBClient, e.subnetGroupName);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.subnetGroupMapper(newObject, e.region);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        newEntity.id = e.id;
        await this.module.subnetGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (id) {
        for (const region of enabledRegions) {
          if (!supportedRegions.includes(region)) continue;
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawObj = await this.getSubnetGroup(client.memoryDBClient, id);
          if (!rawObj) return;
          return this.subnetGroupMapper(rawObj, region);
        }
      } else {
        const out = [];
        for (const region of enabledRegions) {
          if (!supportedRegions.includes(region)) continue;
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawObjs = (await this.getSubnetGroups(client.memoryDBClient)) ?? [];
          for (const obj of rawObjs) {
            const outObj = await this.subnetGroupMapper(obj, region);
            if (outObj) out.push(outObj);
          }
        }
        return out;
      }
    },
    updateOrReplace: (prev: SubnetGroup, next: SubnetGroup) => {
      if (!Object.is(prev.region, next.region)) return 'replace';
      return 'update';
    },
    update: async (es: SubnetGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.SubnetGroup?.[e.subnetGroupName ?? ''];
        const isUpdate = this.module.subnetGroup.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          if (
            !Object.is(cloudRecord.subnets?.length, e.subnets?.length) &&
            !(
              cloudRecord.subnets?.every((asn: string) => !!e.subnets?.find(bsn => Object.is(asn, bsn))) ??
              false
            )
          ) {
            // Subnet group needs to be updated
            let subnetIds: string[] = [];
            if (!e.subnets?.length) {
              const defaultSubnets = await this.getDefaultSubnets(ctx, e.region);
              subnetIds = defaultSubnets.map(sn => sn.subnetId ?? '');
            } else {
              subnetIds = e.subnets;
            }
            await this.handleSubnetGroupCreateOrUpdate(
              'update',
              client.memoryDBClient,
              ctx,
              e.region,
              e.subnetGroupName,
              subnetIds,
              e.description,
            );
            update = true;
          }
          if (!Object.is(cloudRecord.description, e.description)) {
            await this.handleSubnetGroupCreateOrUpdate(
              'update',
              client.memoryDBClient,
              ctx,
              e.region,
              e.subnetGroupName,
              e.subnets ?? [],
              e.description,
            );
            update = true;
          }
          if (update) {
            const rawObj = await this.getSubnetGroup(client.memoryDBClient, e.subnetGroupName ?? '');
            if (!rawObj) continue;
            const newObj = await this.subnetGroupMapper(rawObj, e.region);
            if (!newObj) continue;
            newObj.id = e.id;
            await this.module.subnetGroup.db.update(newObj, ctx);
            out.push(newObj);
          } else {
            // Restore record
            cloudRecord.id = e.id;
            await this.module.subnetGroup.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // Replace record
          const newSubnetGroup = await this.module.subnetGroup.cloud.create(e, ctx);
          await this.module.subnetGroup.cloud.delete(cloudRecord, ctx);
          out.push(newSubnetGroup);
        }
      }
      return out;
    },
    delete: async (es: SubnetGroup[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteSubnetGroup(client.memoryDBClient, e.subnetGroupName ?? '');
      }
    },
  });

  constructor(module: AwsMemoryDBModule) {
    super();
    this.module = module;
    super.init();
  }
}
