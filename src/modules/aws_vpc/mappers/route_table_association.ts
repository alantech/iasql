import { RouteTableAssociation as AwsRouteTableAssociation } from '@aws-sdk/client-ec2/dist-types/models';

import { AWS } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { RouteTableAssociation } from '../entity';
import { AwsVpcModule } from '../index';

export class RouteTableAssociationMapper extends MapperBase<RouteTableAssociation> {
  module: AwsVpcModule;
  entity = RouteTableAssociation;
  equals = (a: RouteTableAssociation, b: RouteTableAssociation) =>
    Object.is(a.routeTable?.routeTableId, b.routeTable?.routeTableId) &&
    Object.is(a.isMain, b.isMain) &&
    Object.is(a.subnet?.subnetId, b.subnet?.subnetId) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId);

  private async getSubnet(ctx: Context, id: string, region: string) {
    return (
      (await this.module.subnet.db.read(
        ctx,
        this.module.subnet.generateId({ subnetId: id ?? '', region }),
      )) ??
      (await this.module.subnet.cloud.read(
        ctx,
        this.module.subnet.generateId({ subnetId: id ?? '', region }),
      ))
    );
  }

  private async getRouteTable(ctx: Context, id: string, region: string) {
    return (
      (await this.module.routeTable.db.read(
        ctx,
        this.module.routeTable.generateId({ routeTableId: id ?? '', region }),
      )) ??
      (await this.module.routeTable.cloud.read(
        ctx,
        this.module.routeTable.generateId({ routeTableId: id ?? '', region }),
      ))
    );
  }

  private async getVpc(ctx: Context, vpcId: string, region: string) {
    return (
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId, region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId, region })))
    );
  }

  async routeTableAssociationMapper(
    routeTableAssociation: AwsRouteTableAssociation,
    region: string,
    vpcId: string,
    ctx: Context,
  ) {
    const out: RouteTableAssociation = new RouteTableAssociation();

    out.routeTableAssociationId = routeTableAssociation.RouteTableAssociationId;
    out.isMain = routeTableAssociation.Main ?? false;
    out.routeTable = await this.getRouteTable(ctx, routeTableAssociation.RouteTableId!, region);
    if (routeTableAssociation.SubnetId) {
      const subnet = await this.getSubnet(ctx, routeTableAssociation.SubnetId, region);
      if (subnet) out.subnet = subnet;
    }
    out.vpc = await this.getVpc(ctx, vpcId, region);

    return out;
  }

  cloud: Crud<RouteTableAssociation> = new Crud({
    create: async (es: RouteTableAssociation[], ctx: Context) => {
      const out: RouteTableAssociation[] = [];
      for (const a of es) {
        if (a.isMain) {
          // can't create a main route table, in this case the old entry should be updated
          // delete the new entry from the db
          await this.module.routeTableAssociation.db.delete(a, ctx);
          continue;
        }

        const client = (await ctx.getAwsClient(a.routeTable.region)) as AWS;
        if (a.routeTable.routeTableId) {
          a.routeTableAssociationId = (
            await client.ec2client.associateRouteTable({
              SubnetId: a.subnet!.subnetId,
              RouteTableId: a.routeTable.routeTableId,
            })
          ).AssociationId;
          await this.module.routeTableAssociation.db.update(a, ctx); // write back the associationId to the db
          out.push(a);
        }
      }
      return out;
    },
    delete: async (es: RouteTableAssociation[], ctx: Context) => {
      await Promise.all(
        es.map(async a => {
          if (a.isMain) {
            if (
              !(await this.module.routeTable.db.read(
                ctx,
                this.module.routeTable.generateId({
                  routeTableId: a.routeTable.routeTableId ?? '',
                  region: a.vpc.region,
                }),
              ))
            )
              await this.module.routeTable.db.create(a.routeTable, ctx);

            a.routeTable = await this.module.routeTable.db.read(
              ctx,
              this.module.routeTable.generateId({
                routeTableId: a.routeTable.routeTableId ?? '',
                region: a.vpc.region,
              }),
            );
            await this.module.routeTableAssociation.db.create(a, ctx);
            return;
          }
          const client = (await ctx.getAwsClient(a.vpc?.region)) as AWS;
          await client.ec2client.disassociateRouteTable({ AssociationId: a.routeTableAssociationId });
        }),
      );
    },
    read: async (ctx: Context, id?: string) => {
      const out: RouteTableAssociation[] = [];
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          for (const rawRouteTable of await this.module.routeTable.getRouteTables(client.ec2client)) {
            if (rawRouteTable.Associations)
              for (const rawAssociation of rawRouteTable.Associations) {
                const association = await this.routeTableAssociationMapper(
                  rawAssociation,
                  region,
                  rawRouteTable.VpcId,
                  ctx,
                );
                if (!association) continue;
                out.push(association);
              }
          }
        }),
      );
      if (!!id) return out.find(a => a.routeTableAssociationId === id);
      return out;
    },
    update: async (es: RouteTableAssociation[], ctx: Context) => {
      const out: RouteTableAssociation[] = [];
      for (const a of es) {
        const client = (await ctx.getAwsClient(a.vpc?.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.RouteTableAssociation?.[
          this.entityId(a)
        ] as RouteTableAssociation;

        if (cloudRecord.isMain) {
          if (cloudRecord.vpc.vpcId !== a.vpc.vpcId) {
            // vpc id for a main route table can't be changed, write it back to the db
            cloudRecord.id = a.id;
            await this.module.routeTableAssociation.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            // a new route table in the same vpc should be the main one
            a.routeTableAssociationId = (
              await client.ec2client.replaceRouteTableAssociation({
                AssociationId: cloudRecord.routeTableAssociationId,
                RouteTableId: a.routeTable.routeTableId,
              })
            ).NewAssociationId;
            await this.module.routeTableAssociation.db.update(a, ctx);
            out.push(a);
          }
          continue;
        }

        // the subnet should be assigned to a new route table
        if (cloudRecord.subnet?.subnetId !== a.subnet?.subnetId) {
          // subnet id can't be changed. the record is for the association belonging this subnet.
          cloudRecord.id = a.id;
          await this.module.routeTableAssociation.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          // just explicitly associating the subnet to a new route table
          a.routeTableAssociationId = (
            await client.ec2client.replaceRouteTableAssociation({
              AssociationId: cloudRecord.routeTableAssociationId,
              RouteTableId: a.routeTable.routeTableId,
            })
          ).NewAssociationId;
          await this.module.routeTableAssociation.db.update(a, ctx);
          out.push(a);
        }
      }
      return out;
    },
    updateOrReplace: () => 'update',
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
