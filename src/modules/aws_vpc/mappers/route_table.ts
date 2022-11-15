import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import {
  Route as AwsRoute,
  RouteTable as AwsRouteTable,
} from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Route } from '../entity';
import { RouteTable } from '../entity';
import { AwsVpcModule } from '../index';
import { convertTagsFromAws, eqTags } from './tags';

export class RouteTableMapper extends MapperBase<RouteTable> {
  module: AwsVpcModule;
  entity = RouteTable;
  equals = (a: RouteTable, b: RouteTable) => {
    return (
      a.vpc.vpcId === b.vpc.vpcId &&
      !!a.explicitlyAssociatedSubnets?.every(
        sa => !!b.explicitlyAssociatedSubnets?.find(sb => Object.is(sa.id, sb.id)),
      ) &&
      a.isMain === b.isMain &&
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

  routeMapper(route: AwsRoute, routeTable: RouteTable, ctx: Context) {
    const out = new Route();
    out.routeTable = routeTable;
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

  async routeTableMapper(routeTable: AwsRouteTable, ctx: Context) {
    const out = new RouteTable();

    out.routeTableId = routeTable.RouteTableId;
    out.vpc =
      (await this.module.vpc.db.read(ctx, routeTable.VpcId)) ??
      (await this.module.vpc.cloud.read(ctx, routeTable.VpcId));

    out.explicitlyAssociatedSubnets = [];
    if (routeTable.Associations) {
      for (const rta of routeTable.Associations) {
        if (rta.Main) out.isMain = true;
        if (rta.SubnetId) {
          const subnet = await this.getSubnet(ctx, rta.SubnetId, out.vpc.region);
          if (subnet) out.explicitlyAssociatedSubnets.push(subnet);
        }
      }
    }

    out.routes = [];
    if (routeTable.Routes)
      for (const rawRoute of routeTable.Routes) {
        const route = await this.routeMapper(rawRoute, out, ctx);
        out.routes.push(route);
      }

    out.tags = convertTagsFromAws(routeTable.Tags);
    return out;
  }

  cloud: Crud2<RouteTable> = new Crud2({
    create: async (es: RouteTable[], ctx: Context) => {
      return;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      const out: RouteTable[] = [];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          for (const rawRouteTable of await this.getRouteTables(client.ec2client)) {
            const routeTable = await this.routeTableMapper(rawRouteTable, ctx);
            out.push(routeTable);
          }
        }),
      );
      return out;
    },
    update: async (es: RouteTable[], ctx: Context) => {
      return;
    },
    delete: async (es: RouteTable[], ctx: Context) => {
      return;
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
