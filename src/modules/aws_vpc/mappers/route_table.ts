import { IsNull, Not } from 'typeorm';

import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import { CreateRouteTableCommandInput } from '@aws-sdk/client-ec2/dist-types/commands/CreateRouteTableCommand';
import {
  Route as AwsRoute,
  RouteTable as AwsRouteTable,
  RouteTableAssociation as AwsRouteTableAssociation,
} from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Route, RouteTable, RouteTableAssociation } from '../entity';
import { AwsVpcModule } from '../index';
import { convertTagsForAws, convertTagsFromAws, eqTags } from './tags';

export class RouteTableMapper extends MapperBase<RouteTable> {
  module: AwsVpcModule;
  entity = RouteTable;
  equals = (a: RouteTable, b: RouteTable) => {
    return (
      a.vpc.vpcId === b.vpc.vpcId &&
      this.eqList<RouteTableAssociation>(this.eqAssociation, a.associations, b.associations) &&
      this.eqList<Route>(this.eqRoute, a.routes, b.routes) &&
      eqTags(a.tags, b.tags)
    );
  };

  eqList<T>(eq: (a: T, b: T) => boolean, a?: T[], b?: T[]) {
    const subset1 = !!a?.every(a1 => !!b?.find(a2 => eq(a1, a2)));
    const subset2 = !!b?.every(a1 => !!a?.find(a2 => eq(a1, a2)));
    return subset1 && subset2;
  }

  eqAssociation(a: RouteTableAssociation, b: RouteTableAssociation) {
    return Object.is(a.subnet?.subnetId, b.subnet?.subnetId) && Object.is(a.isMain, b.isMain);
  }

  eqRoute(a: Route, b: Route) {
    return (
      a.DestinationCidrBlock === b.DestinationCidrBlock &&
      a.DestinationIpv6CidrBlock === b.DestinationIpv6CidrBlock &&
      a.DestinationPrefixListId === b.DestinationPrefixListId &&
      a.EgressOnlyInternetGatewayId === b.EgressOnlyInternetGatewayId &&
      a.GatewayId === b.GatewayId &&
      a.InstanceId === b.InstanceId &&
      a.InstanceOwnerId === b.InstanceOwnerId &&
      a.NatGatewayId === b.NatGatewayId &&
      a.TransitGatewayId === b.TransitGatewayId &&
      a.LocalGatewayId === b.LocalGatewayId &&
      a.CarrierGatewayId === b.CarrierGatewayId &&
      a.NetworkInterfaceId === b.NetworkInterfaceId &&
      a.VpcPeeringConnectionId === b.VpcPeeringConnectionId &&
      a.CoreNetworkArn === b.CoreNetworkArn
    );
  }

  getRouteTables = paginateBuilder<EC2>(paginateDescribeRouteTables, 'RouteTables');
  getRouteTable = crudBuilderFormat<EC2, 'describeRouteTables', AwsRouteTable | undefined>(
    'describeRouteTables',
    routeTableId => ({ RouteTableIds: [routeTableId] }),
    res => res?.RouteTables?.pop(),
  );

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

  routeMapper(route: AwsRoute) {
    const out = new Route();
    out.DestinationCidrBlock = route.DestinationCidrBlock;
    out.DestinationIpv6CidrBlock = route.DestinationIpv6CidrBlock;
    out.DestinationPrefixListId = route.DestinationPrefixListId;
    out.EgressOnlyInternetGatewayId = route.EgressOnlyInternetGatewayId;
    out.GatewayId = route.GatewayId;
    out.InstanceId = route.InstanceId;
    out.InstanceOwnerId = route.InstanceOwnerId;
    out.NatGatewayId = route.NatGatewayId;
    out.TransitGatewayId = route.TransitGatewayId;
    out.LocalGatewayId = route.LocalGatewayId;
    out.CarrierGatewayId = route.CarrierGatewayId;
    out.NetworkInterfaceId = route.NetworkInterfaceId;
    out.VpcPeeringConnectionId = route.VpcPeeringConnectionId;
    out.CoreNetworkArn = route.CoreNetworkArn;
    return out;
  }

  async routeTableAssociationMapper(
    routeTableAssociation: AwsRouteTableAssociation,
    region: string,
    ctx: Context,
  ) {
    const out: RouteTableAssociation = new RouteTableAssociation();

    out.routeTableAssociationId = routeTableAssociation.RouteTableAssociationId;
    out.isMain = routeTableAssociation.Main ?? false;
    if (routeTableAssociation.SubnetId) {
      const subnet = await this.getSubnet(ctx, routeTableAssociation.SubnetId, region);
      if (subnet) out.subnet = subnet;
    }

    return out;
  }

  async routeTableMapper(routeTable: AwsRouteTable, region: string, ctx: Context) {
    const out = new RouteTable();

    out.routeTableId = routeTable.RouteTableId;
    out.vpc =
      (await this.module.vpc.db.read(
        ctx,
        this.module.vpc.generateId({ vpcId: routeTable.VpcId ?? '', region }),
      )) ??
      (await this.module.vpc.cloud.read(
        ctx,
        this.module.vpc.generateId({ vpcId: routeTable.VpcId ?? '', region }),
      ));
    if (!out.vpc) return undefined;

    out.associations = [];
    if (routeTable.Associations) {
      for (const rawRta of routeTable.Associations) {
        const routeTableAssociation = await this.routeTableAssociationMapper(rawRta, region, ctx);
        out.associations.push(routeTableAssociation);
      }
    }

    out.routes = [];
    if (routeTable.Routes)
      for (const rawRoute of routeTable.Routes) {
        const route = await this.routeMapper(rawRoute);
        out.routes.push(route);
      }

    out.tags = convertTagsFromAws(routeTable.Tags);
    out.region = region;
    return out;
  }

  async createRouteTable(client: EC2, vpcId: string, tags?: { [key: string]: string }) {
    const input: CreateRouteTableCommandInput = {
      VpcId: vpcId,
    };

    const tgs = convertTagsForAws(tags ?? {});
    if (tgs.length > 0) {
      input.TagSpecifications = [
        {
          ResourceType: 'route-table',
          Tags: tgs,
        },
      ];
    }

    return (await client.createRouteTable(input)).RouteTable;
  }

  cloud: Crud2<RouteTable> = new Crud2({
    create: async (es: RouteTable[], ctx: Context) => {
      const out: RouteTable[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // create route table
        const rawRouteTable = await this.createRouteTable(client.ec2client, e.vpc.vpcId!, e.tags);
        if (!rawRouteTable) continue;
        const routeTable = await this.routeTableMapper(rawRouteTable, e.region, ctx);
        if (!routeTable) continue;

        // create routes
        e.routes?.map(async r => {
          if (r.GatewayId === 'local') return; // created by AWS, can't be created by the user
          await client.ec2client.createRoute({
            RouteTableId: routeTable.routeTableId,
            DestinationCidrBlock: r.DestinationCidrBlock,
            DestinationIpv6CidrBlock: r.DestinationIpv6CidrBlock,
            DestinationPrefixListId: r.DestinationPrefixListId,
            // VpcEndpointId: r.VpcEndpointId, // exists in the CreateRouteRequest but not in Route :-?
            EgressOnlyInternetGatewayId: r.EgressOnlyInternetGatewayId,
            GatewayId: r.GatewayId,
            InstanceId: r.InstanceId,
            NatGatewayId: r.NatGatewayId,
            TransitGatewayId: r.TransitGatewayId,
            LocalGatewayId: r.LocalGatewayId,
            CarrierGatewayId: r.CarrierGatewayId,
            NetworkInterfaceId: r.NetworkInterfaceId,
            VpcPeeringConnectionId: r.VpcPeeringConnectionId,
            CoreNetworkArn: r.CoreNetworkArn,
          });
        });

        // route table associations will be handled in `update`, so keep them as they are
        routeTable.associations = e.associations;

        routeTable.id = e.id;
        await this.module.routeTable.db.update(routeTable, ctx);
        out.push(routeTable);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { routeTableId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawRouteTable = await this.getRouteTable(client.ec2client, routeTableId);
        if (!rawRouteTable) return;
        return await this.routeTableMapper(rawRouteTable, region, ctx);
      } else {
        const out: RouteTable[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const rawRouteTable of await this.getRouteTables(client.ec2client)) {
              const routeTable = await this.routeTableMapper(rawRouteTable, region, ctx);
              if (!routeTable) continue;
              out.push(routeTable);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: RouteTable[], ctx: Context) => {
      const out = [];
      for (const el of es) {
        const e: RouteTable = await ctx.orm.findOne(RouteTable, {
          where: { id: el.id },
          relations: ['vpc', 'routes', 'associations'],
        }); // reload from db
        const cloudRecord: RouteTable = ctx?.memo?.cloud?.RouteTable?.[this.entityId(e)];

        if (cloudRecord.vpc.vpcId !== e.vpc.vpcId) {
          // delete and create a new one
          await this.module.routeTable.cloud.delete(cloudRecord, ctx);
          out.push((await this.module.routeTable.cloud.create(e, ctx)) as RouteTable);
          continue;
        }

        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (!this.eqList<Route>(this.eqRoute, e.routes, cloudRecord.routes)) {
          // delete and create routes
        }
        if (
          !this.eqList<RouteTableAssociation>(this.eqAssociation, e.associations, cloudRecord.associations)
        ) {
          // first handle route table associations
          await Promise.all(
            e.associations.map(async a => {
              const oldAssociation: RouteTableAssociation = await ctx.orm.findOne(RouteTableAssociation, {
                relations: ['routeTable', 'routeTable.vpc'],
                routeTableAssociationId: Not(IsNull()),
                where: {
                  routeTable: {
                    vpc: { vpcId: e.vpc.vpcId },
                  },
                  subnet: a.subnet ?? null,
                  isMain: a.isMain,
                },
              });
              if (oldAssociation) {
                // replace
                a.routeTableAssociationId = (
                  await client.ec2client.replaceRouteTableAssociation({
                    AssociationId: oldAssociation.routeTableAssociationId,
                    RouteTableId: e.routeTableId,
                  })
                ).NewAssociationId;
                if (oldAssociation.routeTable.id !== e.id) {
                  // in case user has updated the row
                  await ctx.orm.remove(RouteTableAssociation, oldAssociation);
                }
                await ctx.orm.save(RouteTableAssociation, a);
                ctx.memo.db.RouteTable[this.entityId(oldAssociation.routeTable)] = await ctx.orm.findOne(
                  RouteTable,
                  {
                    where: { id: oldAssociation.routeTable.id },
                  },
                );
              } else {
                // create
                a.routeTableAssociationId = (
                  await client.ec2client.associateRouteTable({
                    SubnetId: a.subnet?.subnetId,
                    RouteTableId: e.routeTableId,
                  })
                ).AssociationId;
                await ctx.orm.save(RouteTableAssociation, a);
              }
            }),
          );
          ctx.memo.db.RouteTable[this.entityId(e)] = e;
          out.push(e);
        }

        return out;
      }
    },
    delete: async (es: RouteTable[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (e.associations?.find(a => a.isMain)) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          await this.module.routeTable.db.update(e, ctx); // does it cascade to creation of Route/RouteTableAssociation
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.RouteTable[this.entityId(e)] = e;
          continue;
        }

        // first we need to remove the explicit subnet associations
        if (e.associations) {
          await Promise.all(
            e.associations.map(async a => {
              await client.ec2client.disassociateRouteTable({ AssociationId: a.routeTableAssociationId });
            }),
          );
        }
        await client.ec2client.deleteRouteTable({ RouteTableId: e.routeTableId });
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
