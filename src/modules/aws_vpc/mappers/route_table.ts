import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import { CreateRouteTableCommandInput } from '@aws-sdk/client-ec2/dist-types/commands/CreateRouteTableCommand';
import {
  Route as AwsRoute,
  RouteTable as AwsRouteTable,
} from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { getCloudId } from '../../../services/cloud-id';
import { findDiff } from '../../../services/diff';
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
      this.eqListItems<Route>(this.eqRoute, a.routes, b.routes) &&
      eqTags(a.tags, b.tags)
    );
  };

  eqListItems<T>(eq: (a: T, b: T) => boolean, a?: T[], b?: T[]) {
    const subset1 = !!a?.every(a1 => !!b?.find(a2 => eq(a1, a2)));
    const subset2 = !!b?.every(a1 => !!a?.find(a2 => eq(a1, a2)));
    return subset1 && subset2;
  }

  findRoutesDiff(dbEntities: Route[], cloudEntities: Route[]) {
    const routeId = (route: Route) => {
      const cloudColumns = getCloudId(Route) as string[];
      return cloudColumns.map(col => (route as any)[col]).join('|');
    };
    const { entitiesInDbOnly, entitiesInAwsOnly } = findDiff(
      dbEntities,
      cloudEntities,
      routeId,
      () => true, // dummy function because all fields are cloud id
    );
    return { entitiesInDbOnly, entitiesInAwsOnly };
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
          await RouteTableMapper.createRoute(client.ec2client, routeTable, r);
        });

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
      for (const e of es) {
        const cloudRecord: RouteTable = ctx?.memo?.cloud?.RouteTable?.[this.entityId(e)];

        if (cloudRecord.vpc.vpcId !== e.vpc.vpcId) {
          // delete and create a new one
          await this.module.routeTable.cloud.delete(cloudRecord, ctx);
          out.push((await this.module.routeTable.cloud.create(e, ctx)) as RouteTable);
          continue;
        }

        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (!this.eqListItems<Route>(this.eqRoute, e.routes, cloudRecord.routes)) {
          // delete and create routes
          const { entitiesInDbOnly, entitiesInAwsOnly } = this.findRoutesDiff(e.routes, cloudRecord.routes);
          for (const r of entitiesInAwsOnly) {
            if (r.GatewayId === 'local') {
              // default route, can't be deleted by the user
              await ctx.orm.save(Route, r);
              ctx.memo.db.RouteTable[this.entityId(e)] = await ctx.orm.find(RouteTable, {
                where: { id: e.id },
              });
              continue;
            }
            await RouteTableMapper.deleteRoute(client.ec2client, e, r);
          }
          for (const r of entitiesInDbOnly) {
            await RouteTableMapper.createRoute(client.ec2client, e, r);
          }
        }

        return out;
      }
    },
    delete: async (es: RouteTable[], ctx: Context) => {
      const associations: RouteTableAssociation[] = ctx.memo?.cloud?.RouteTableAssociation
        ? Object.values(ctx.memo?.cloud?.RouteTableAssociation)
        : await this.module.routeTableAssociation.cloud.read(ctx);

      await Promise.all(
        es.map(async e => {
          if (associations.find(a => a.routeTable.routeTableId === e.routeTableId && a.isMain)) {
            // it's the main route table, can't be deleted so return it to the db
            const vpcDbRecord = await this.module.vpc.db.read(
              ctx,
              this.module.vpc.generateId({ vpcId: e.vpc?.vpcId ?? '', region: e.region }),
            );
            if (vpcDbRecord) await this.module.routeTable.db.update(e, ctx);
            return;
          }
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          await client.ec2client.deleteRouteTable({ RouteTableId: e.routeTableId });
        }),
      );
    },
  });

  private static async deleteRoute(client: EC2, routeTable: RouteTable, r: Route) {
    return await client.deleteRoute({
      DestinationCidrBlock: r.DestinationCidrBlock,
      DestinationIpv6CidrBlock: r.DestinationIpv6CidrBlock,
      DestinationPrefixListId: r.DestinationPrefixListId,
      RouteTableId: routeTable.routeTableId,
    });
  }

  private static async createRoute(client: EC2, routeTable: RouteTable, r: Route) {
    return (
      await client.createRoute({
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
      })
    ).Return;
  }

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
