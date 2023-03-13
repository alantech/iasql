import {
  DBSubnetGroup as AWSDBSubnetGroup,
  CreateDBSubnetGroupCommandInput,
  RDS as AWSRDS,
  paginateDescribeDBSubnetGroups,
} from '@aws-sdk/client-rds';

import { AwsRdsModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsVpcModule } from '../../aws_vpc';
import { Subnet as VPCSubnet, Vpc } from '../../aws_vpc/entity';
import { Context, Crud, MapperBase } from '../../interfaces';
import { DBSubnetGroup } from '../entity';

export class DBSubnetGroupMapper extends MapperBase<DBSubnetGroup> {
  module: AwsRdsModule;
  entity = DBSubnetGroup;

  equals = (a: DBSubnetGroup, b: DBSubnetGroup) =>
    Object.is(a.arn, b.arn) &&
    Object.is(a.description, b.description) &&
    Object.is(a.name, b.name) &&
    (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false);

  async subnetGroupMapper(ctx: Context, sg: AWSDBSubnetGroup, region: string) {
    console.log('in subnetGroupMapper');
    console.log(sg);
    if (!sg.DBSubnetGroupArn) return undefined; // we cannot have a cloud subnet group without arn
    const out = new DBSubnetGroup();
    out.arn = sg.DBSubnetGroupArn;
    if (sg.DBSubnetGroupDescription) out.description = sg.DBSubnetGroupDescription;
    if (sg.DBSubnetGroupName) out.name = sg.DBSubnetGroupName;
    const subnets = [];
    if (sg.Subnets?.length) {
      subnets.push(...sg.Subnets.map(sn => sn.SubnetIdentifier ?? ''));
    }
    out.subnets = subnets;
    out.region = region;
    console.log('final is');
    console.log(out);
    return out;
  }

  createDBSubnetGroup = crudBuilderFormat<AWSRDS, 'createDBSubnetGroup', AWSDBSubnetGroup | undefined>(
    'createDBSubnetGroup',
    input => input,
    res => res?.DBSubnetGroup,
  );

  getDBSubnetGroup = crudBuilderFormat<AWSRDS, 'describeDBSubnetGroups', AWSDBSubnetGroup | undefined>(
    'describeDBSubnetGroups',
    DBSubnetGroupName => ({ DBSubnetGroupName }),
    res => (res?.DBSubnetGroups ?? []).pop(),
  );

  getDBSubnetGroups = paginateBuilder<AWSRDS>(paginateDescribeDBSubnetGroups, 'DBSubnetGroups');

  modifyDBSubnetGroup = crudBuilderFormat<AWSRDS, 'modifyDBSubnetGroup', AWSDBSubnetGroup | undefined>(
    'modifyDBSubnetGroup',
    input => input,
    res => res?.DBSubnetGroup,
  );

  deleteDBSubnetGroup = crudBuilder<AWSRDS, 'deleteDBSubnetGroup'>(
    'deleteDBSubnetGroup',
    DBSubnetGroupName => ({ DBSubnetGroupName }),
  );

  getDefaultSubnets = async (ctx: Context, region: string): Promise<string[]> => {
    const defaultVpc: Vpc = (await awsVpcModule.vpc.db.read(ctx))
      .filter((vpc: Vpc) => vpc.isDefault)
      .filter((vpc: Vpc) => vpc.region === region)
      .pop();
    const subnets: VPCSubnet[] = await awsVpcModule.subnet.db.read(ctx);
    const finalSubnets = [];
    for (const subnet of subnets) {
      if (subnet.vpc.id === defaultVpc.id) {
        if (subnet.subnetId) finalSubnets.push(subnet.subnetId);
      }
    }
    return finalSubnets;
  };

  async getSubnets(ctx: Context, region: string, subnets: string[] | undefined): Promise<string[]> {
    // Create subnet group first
    if (!subnets?.length) {
      const defaultSubnets = await this.getDefaultSubnets(ctx, region);
      return defaultSubnets;
    } else return subnets;
  }

  cloud = new Crud({
    create: async (es: DBSubnetGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        let subnets = [];
        if (!e.subnets?.length) subnets = await this.getDefaultSubnets(ctx, e.region);
        else subnets = e.subnets;

        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const subnetGroupInput: CreateDBSubnetGroupCommandInput = {
          DBSubnetGroupName: e.name,
          DBSubnetGroupDescription: e.description,
          SubnetIds: subnets,
        };
        const result = await this.createDBSubnetGroup(client.rdsClient, subnetGroupInput);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getDBSubnetGroup(client.rdsClient, result?.DBSubnetGroupName);
        if (newObject) {
          // We map this into the same kind of entity as `obj`
          const newEntity = await this.subnetGroupMapper(ctx, newObject, e.region);
          if (!newEntity) continue;
          newEntity.id = e.id;
          // Save the record back into the database to get the new fields updated
          await this.module.dbSubnetGroup.db.update(newEntity, ctx);
          out.push(newEntity);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (id) {
        const { name, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const subnetGroup = await this.getDBSubnetGroup(client.rdsClient, name);
        if (!subnetGroup) return;
        return this.subnetGroupMapper(ctx, subnetGroup, region);
      } else {
        const out: DBSubnetGroup[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const subnetGroups = await this.getDBSubnetGroups(client.rdsClient);
            for (const sg of subnetGroups) {
              const e = await this.subnetGroupMapper(ctx, sg, region);
              if (!e) continue;
              out.push(e);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: DBSubnetGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.DBSubnetGroup?.[this.entityId(e)];
        cloudRecord.id = e.id;

        if (e.arn !== cloudRecord.arn) {
          // we cannot modify ARN, restore it
          await this.module.dbSubnetGroup.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          let subnets = [];
          if (!cloudRecord.subnets?.length) subnets = await this.getDefaultSubnets(ctx, cloudRecord.region);
          else subnets = cloudRecord.subnets;

          // we need to update the record
          const result = await this.modifyDBSubnetGroup(client.rdsClient, {
            DBSubnetGroupDescription: e.description,
            DBSubnetGroupName: e.name,
            SubnetIds: subnets,
          });
          cloudRecord.id = e.id;
          out.push(cloudRecord);
        }
      }
      return out;
    },
    delete: async (es: DBSubnetGroup[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteDBSubnetGroup(client.rdsClient, e.name);
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}
