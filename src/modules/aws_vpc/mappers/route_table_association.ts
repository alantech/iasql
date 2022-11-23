import { EC2 } from '@aws-sdk/client-ec2';
import { RouteTableAssociation as AwsRouteTableAssociation } from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { RouteTableAssociation } from '../entity';
import { AwsVpcModule } from '../index';

export class RouteTableAssociationMapper extends MapperBase<RouteTableAssociation> {
  module: AwsVpcModule;
  entity = RouteTableAssociation;
  equals = (a: RouteTableAssociation, b: RouteTableAssociation) =>
    Object.is(a.routeTable?.routeTableId, b.routeTable?.routeTableId) &&
    Object.is(a.isMain, b.isMain) &&
    Object.is(a.subnet?.subnetId, b.subnet?.subnetId);

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

  async routeTableAssociationMapper(
    routeTableAssociation: AwsRouteTableAssociation,
    region: string,
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

    return out;
  }

  cloud: Crud2<RouteTableAssociation> = new Crud2({
    create: async (es: RouteTableAssociation[], ctx: Context) => {
      const out: RouteTableAssociation[] = [];
      for (const a of es) {
        const client = (await ctx.getAwsClient(a.routeTable.region)) as AWS;
        out.push(await this.createOrReplaceAssociation(ctx, a, client.ec2client));
      }
      return out;
    },
    delete: async (es: RouteTableAssociation[], ctx: Context) => {
      await Promise.all(
        es.map(async a => {
          if (a.isMain) {
            const routeTableDbRecord = await this.module.routeTable.db.read(
              ctx,
              this.module.routeTable.generateId({
                routeTableId: a.routeTable.routeTableId ?? '',
                region: a.routeTable.region,
              }),
            );
            // main route table can't be disassociated, return it to the db
            if (routeTableDbRecord) await this.module.routeTableAssociation.db.update(a, ctx);
            return;
          }
          const client = (await ctx.getAwsClient(a.routeTable.region)) as AWS;
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
                const association = await this.routeTableAssociationMapper(rawAssociation, region, ctx);
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
        const client = (await ctx.getAwsClient(a.routeTable.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.RouteTableAssociation?.[this.entityId(a)];

        if (this.module.routeTableAssociation.cloud.updateOrReplace(cloudRecord, a) === 'update')
          out.push(await this.createOrReplaceAssociation(ctx, a, client.ec2client));
        else {
          // route table has been changed, should delete and recreate
          await this.module.routeTableAssociation.cloud.delete(cloudRecord, ctx);
          const newAssociation = await this.module.routeTableAssociation.cloud.create(a, ctx);
          if (newAssociation) out.push(newAssociation as RouteTableAssociation);
        }
      }
      return out;
    },
    updateOrReplace: (prev: RouteTableAssociation, next: RouteTableAssociation) => {
      if (prev.isMain && !next.isMain)
        throw new Error('Cannot switch from main to not main. Create a main association for the VPC first.');
      if (prev.routeTable.vpc.vpcId !== next.routeTable.vpc.vpcId && prev.isMain)
        throw new Error(
          'You are trying to associate the main route table for a VPC to a route table that does not belong to that VPC.',
        );
      if (
        prev.routeTable.vpc.vpcId !== next.routeTable.vpc.vpcId ||
        prev.subnet?.subnetId !== next.subnet?.subnetId ||
        prev.isMain !== next.isMain
      )
        return 'replace';
      return 'update';
    },
  });

  private async createOrReplaceAssociation(ctx: Context, a: RouteTableAssociation, client: EC2) {
    const cloudRecords: RouteTableAssociation[] = Object.values(ctx.memo?.cloud?.RouteTableAssociation);
    const oldCloudAssociation = cloudRecords.find(
      r =>
        Object.is(r.routeTable.vpc.vpcId, a.routeTable.vpc.vpcId) &&
        Object.is(r.subnet, a.subnet) &&
        Object.is(r.isMain, a.isMain) &&
        !!r.routeTableAssociationId, // to avoid matching the object itself
    );

    if (oldCloudAssociation) {
      // replace
      a.routeTableAssociationId = (
        await client.replaceRouteTableAssociation({
          AssociationId: oldCloudAssociation.routeTableAssociationId,
          RouteTableId: a.routeTable.routeTableId,
        })
      ).NewAssociationId;
      await this.module.routeTableAssociation.db.update(a, ctx);

      const oldDbAssociation = await this.module.routeTableAssociation.db.read(
        ctx,
        this.entityId(oldCloudAssociation),
      );
      if (oldDbAssociation && oldDbAssociation.id)
        await this.module.routeTableAssociation.db.delete(oldDbAssociation, ctx);

      return a;
    } else {
      // create
      a.routeTableAssociationId = (
        await client.associateRouteTable({
          SubnetId: a.subnet?.subnetId,
          RouteTableId: a.routeTable.routeTableId,
        })
      ).AssociationId;
      await this.module.routeTableAssociation.db.update(a, ctx);
      return a;
    }
  }

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
