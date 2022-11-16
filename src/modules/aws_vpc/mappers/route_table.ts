import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import {
  Route as AwsRoute,
  RouteTable as AwsRouteTable,
  RouteTableAssociation as AwsRouteTableAssociation,
} from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Route, RouteTable, RouteTableAssociation } from '../entity';
import { AwsVpcModule } from '../index';
import { convertTagsFromAws, eqTags } from './tags';

export class RouteTableMapper extends MapperBase<RouteTable> {
  module: AwsVpcModule;
  entity = RouteTable;
  equals = (a: RouteTable, b: RouteTable) => {
    return (
      a.vpc.vpcId === b.vpc.vpcId &&
      !!a.explicitSubnetAssociations?.every(
        esa1 =>
          !!b.explicitSubnetAssociations?.find(
            esa2 =>
              Object.is(esa1.subnet?.subnetId, esa2.subnet?.subnetId) && Object.is(esa1.isMain, esa2.isMain),
          ),
      ) &&
      !!a.routes?.every(ra => !!b.routes?.find(rb => this.eqRoute(ra, rb))) &&
      eqTags(a.tags, b.tags)
    );
  };

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

    out.explicitSubnetAssociations = [];
    if (routeTable.Associations) {
      for (const rawRta of routeTable.Associations) {
        const routeTableAssociation = await this.routeTableAssociationMapper(rawRta, region, ctx);
        out.explicitSubnetAssociations.push(routeTableAssociation);
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

  cloud: Crud2<RouteTable> = new Crud2({
    create: async (es: RouteTable[], ctx: Context) => {
      return;
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
      return;
    },
    delete: async (es: RouteTable[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.vpc.region)) as AWS;

        if (e.explicitSubnetAssociations?.find(esa => esa.isMain)) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          await this.module.routeTable.db.update(e, ctx); // does it cascade to creation of Route/RouteTableAssociation
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.RouteTable[this.entityId(e)] = e;
        }
        // first we need to remove the explicit subnet associations
        if (e.explicitSubnetAssociations) {
          await Promise.all(
            e.explicitSubnetAssociations.map(async esa => {
              await client.ec2client.disassociateRouteTable({ AssociationId: esa.routeTableAssociationId });
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
