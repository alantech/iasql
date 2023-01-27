import _ from 'lodash';

import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import { CreateRouteTableCommandInput } from '@aws-sdk/client-ec2/dist-types/commands/CreateRouteTableCommand';
import {
  Route as AwsRoute,
  RouteTable as AwsRouteTable,
} from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { getCloudId } from '../../../services/cloud-id';
import { findDiff } from '../../../services/diff';
import { Context, Crud2, IdFields, MapperBase } from '../../interfaces';
import { Route, RouteTable } from '../entity';
import { AwsVpcModule } from '../index';
import { convertTagsForAws, convertTagsFromAws, eqTags } from './tags';

export class RouteMapper extends MapperBase<Route> {
  module: AwsVpcModule;
  entity = Route;
  entityId = (e: Route) =>
    `${e.id}`;
  idFields = (id: string) => {
    return { id };
  };
  generateId = (fields: IdFields) => {
    const requiredFields = ['id'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.id}`;
  };
  equals = (a: Route, b: Route) => {
    return this.eqRoute(a, b);
  };

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
    return _.isEqual(_.omit(a, ['id', 'routeTable']), _.omit(b, ['id', 'routeTable']));
  }

  getRouteTables = paginateBuilder<EC2>(paginateDescribeRouteTables, 'RouteTables');
  getRouteTable = crudBuilderFormat<EC2, 'describeRouteTables', AwsRouteTable | undefined>(
    'describeRouteTables',
    routeTableId => ({ RouteTableIds: [routeTableId] }),
    res => res?.RouteTables?.pop(),
  );

  createRoute = crudBuilder2<EC2, 'createRoute'>(
    'createRoute',
    (r: Route) => ({
      RouteTableId: r.routeTable.routeTableId,
      DestinationCidrBlock: r.destinationCidrBlock,
      DestinationIpv6CidrBlock: r.destinationIpv6CidrBlock,
      DestinationPrefixListId: r.destinationPrefixListId,
      EgressOnlyInternetGatewayId: r.egressOnlyInternetGatewayId,
      GatewayId: r.gatewayId,
      InstanceId: r.instanceId,
      NatGatewayId: r.natGatewayId,
      TransitGatewayId: r.transitGatewayId,
      LocalGatewayId: r.localGatewayId,
      CarrierGatewayId: r.carrierGatewayId,
      NetworkInterfaceId: r.networkInterfaceId,
      VpcPeeringConnectionId: r.vpcPeeringConnectionId,
      CoreNetworkArn: r.coreNetworkArn,
    }),
  );

  routeMapper(route: AwsRoute, routeTableId: string) {
    const out = new Route();
    if (!routeTableId) return undefined;
    out.destinationCidrBlock = route.DestinationCidrBlock;
    out.destinationIpv6CidrBlock = route.DestinationIpv6CidrBlock;
    out.destinationPrefixListId = route.DestinationPrefixListId;
    out.egressOnlyInternetGatewayId = route.EgressOnlyInternetGatewayId;
    out.gatewayId = route.GatewayId;
    out.instanceId = route.InstanceId;
    out.instanceOwnerId = route.InstanceOwnerId;
    out.natGatewayId = route.NatGatewayId;
    out.transitGatewayId = route.TransitGatewayId;
    out.localGatewayId = route.LocalGatewayId;
    out.carrierGatewayId = route.CarrierGatewayId;
    out.networkInterfaceId = route.NetworkInterfaceId;
    out.vpcPeeringConnectionId = route.VpcPeeringConnectionId;
    out.coreNetworkArn = route.CoreNetworkArn;
    return out;
  }

  cloud: Crud2<Route> = new Crud2({
    create: async (es: Route[], ctx: Context) => {
      const out: Route[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.routeTable.region)) as AWS;
        if (e.gatewayId === 'local') return; // created by AWS, can't be created by the user
        await this.createRoute(client.ec2client, e);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        // const dbR: Route = await this.module.route.db.read(ctx, id);
        // const client = (await ctx.getAwsClient(dbR.routeTable.region)) as AWS;
        // return await this.routeTableMapper(rawRouteTable, region, ctx);
      } else {
        const out: Route[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawRouteTables: AwsRouteTable[] = await this.getRouteTables(client.ec2client);
            for (const rawRouteTable of rawRouteTables) {
              if (!rawRouteTable) continue;
              const routes: (Route | undefined)[] = rawRouteTable.Routes?.map(r => this.routeMapper(r, rawRouteTable.RouteTableId ?? '')).filter(r => !!r) ?? [];
              out.push(...(routes as Route[]));
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
      await Promise.all(
        es.map(async e => {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          // fails if it's the main route table, but the routeTableAssociation.cloud.delete would write it back to the db
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

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
