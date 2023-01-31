import { EC2, paginateDescribeRouteTables } from '@aws-sdk/client-ec2';
import { CreateRouteTableCommandInput } from '@aws-sdk/client-ec2/dist-types/commands/CreateRouteTableCommand';
import { RouteTable as AwsRouteTable } from '@aws-sdk/client-ec2/dist-types/models/models_1';

import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Route, RouteTable } from '../entity';
import { AwsVpcModule } from '../index';
import { convertTagsForAws, convertTagsFromAws, eqTags } from './tags';

export class RouteTableMapper extends MapperBase<RouteTable> {
  module: AwsVpcModule;
  entity = RouteTable;
  equals = (a: RouteTable, b: RouteTable) => {
    return a.vpc.vpcId === b.vpc.vpcId && eqTags(a.tags, b.tags);
  };

  getRouteTables = paginateBuilder<EC2>(paginateDescribeRouteTables, 'RouteTables');
  getRouteTable = crudBuilderFormat<EC2, 'describeRouteTables', AwsRouteTable | undefined>(
    'describeRouteTables',
    routeTableId => ({ RouteTableIds: [routeTableId] }),
    res => res?.RouteTables?.pop(),
  );

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
    out.tags = convertTagsFromAws(routeTable.Tags);
    out.region = region;
    out.routes = routeTable.Routes ?? [];

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
    updateOrReplace: (prev: RouteTable, next: RouteTable) => {
      if (prev.vpc.vpcId !== next.vpc.vpcId) return 'replace';
      return 'update';
    },
    update: async (es: RouteTable[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord: RouteTable = ctx?.memo?.cloud?.RouteTable?.[this.entityId(e)];
        const isUpdate = this.module.routeTable.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (!isUpdate) {
          // delete and create a new one
          await this.module.routeTable.cloud.delete(cloudRecord, ctx);
          out.push((await this.module.routeTable.cloud.create(e, ctx)) as RouteTable);
          continue;
        }
        // Restore record
        cloudRecord.id = e.id;
        await this.module.routeTable.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: RouteTable[], ctx: Context) => {
      await Promise.all(
        es.map(async e => {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          // fails if it's the main route table, but the routeTableAssociation.cloud.delete would write it back to the db
          try {
            await client.ec2client.deleteRouteTable({ RouteTableId: e.routeTableId });
          } catch (err: any) {
            if (err.Code === 'InvalidRouteTableID.NotFound') return; // If we cannot find the route we continue
            throw err;
          }
        }),
      );
    },
  });

  db = new Crud2<RouteTable>({
    create: async (es: RouteTable[], ctx: Context) => {
      await ctx.orm.save(RouteTable, es);
      for (const e of es) {
        const routes = e.routes.map(r => this.module.route.routeMapper(r, e, e.region));
        await ctx.orm.save(Route, routes);
      }
    },
    update: (es: RouteTable[], ctx: Context) => ctx.orm.save(RouteTable, es),
    delete: (es: RouteTable[], ctx: Context) => ctx.orm.remove(RouteTable, es),
    read: async (ctx: Context, id?: string) => {
      const { routeTableId, region } = id
        ? this.idFields(id)
        : { routeTableId: undefined, region: undefined };
      const opts =
        routeTableId && region
          ? {
              relations: ['vpc'],
              where: {
                routeTableId,
                region,
              },
            }
          : {};
      return await ctx.orm.find(RouteTable, opts);
    },
  });
  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
