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
  entityId = (e: Route) => `${e.routeTable.routeTableId ?? e.routeTable.id}|${e.destination}`;
  idFields = (id: string) => {
    const [routeTableId, destination] = id.split('|');
    return { routeTableId, destination };
  };
  generateId = (fields: IdFields) => {
    const requiredFields = ['routeTableId', 'destination'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.routeTableId}|${fields.destination}`;
  };
  equals = (a: Route, b: Route) => {
    return this.eqRoute(a, b);
  };
  cidrIPv4Pattern = new RegExp(
    '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?).){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(3[0-2]|[12][0-9]|[1-9])$',
  );
  cidrIPv6Pattern = new RegExp(
    '^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$',
  );
  prefixedListPattern = new RegExp('^pl-[wd]+$');

  eqRoute(a: Route, b: Route) {
    return _.isEqual(
      _.omit(a, ['id', 'routeTable', 'destination']),
      _.omit(b, ['id', 'routeTable', 'destination']),
    );
  }

  createRoute = crudBuilder2<EC2, 'createRoute'>('createRoute', (r: Route) => ({
    RouteTableId: r.routeTable.routeTableId,
    DestinationCidrBlock: this.cidrIPv4Pattern.test(r.destination) ? r.destination : undefined,
    DestinationIpv6CidrBlock: this.cidrIPv6Pattern.test(r.destination) ? r.destination : undefined,
    DestinationPrefixListId: this.prefixedListPattern.test(r.destination) ? r.destination : undefined,
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
  }));

  routeMapper(route: AwsRoute, routeTable: RouteTable) {
    const out = new Route();
    if (
      !routeTable ||
      (!route.DestinationCidrBlock && !route.DestinationIpv6CidrBlock && !route.DestinationPrefixListId)
    ) {
      return undefined;
    }
    out.routeTable = routeTable;
    out.destination =
      route.DestinationCidrBlock ?? route.DestinationIpv6CidrBlock ?? route.DestinationPrefixListId ?? '';
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
      if (!!id) {
        const { routeTableId, destination } = this.idFields(id);
        const routeTable: RouteTable = ctx.memo?.cloud?.RouteTable[routeTableId]
          ? ctx.memo?.cloud?.RouteTable[routeTableId]
          : await this.module.routeTable.cloud.read(ctx, routeTableId);
        if (!routeTable) throw Error('RouteTable need to be loaded first');
        const rawRoute = routeTable.routes.find(r =>
          [r.DestinationCidrBlock, r.DestinationIpv6CidrBlock, r.DestinationPrefixListId].includes(
            destination,
          ),
        );
        if (!rawRoute) return;
        return await this.routeMapper(rawRoute, routeTable);
      } else {
        const out: Route[] = [];
        const routeTables: RouteTable[] = ctx.memo?.cloud?.RouteTable
          ? Object.values(ctx.memo?.cloud?.RouteTable)
          : await this.module.routeTable.cloud.read(ctx);
        for (const rt of routeTables) {
          if (!rt) continue;
          const routes: (Route | undefined)[] =
            rt.routes?.map(r => this.routeMapper(r, rt)).filter(r => !!r) ?? [];
          out.push(...(routes as Route[]));
        }
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
