import {
  CreateVpcPeeringConnectionCommandInput,
  DescribeVpcPeeringConnectionsCommandInput,
  EC2,
  paginateDescribeVpcPeeringConnections,
  Tag,
  VpcPeeringConnection as AwsPeeringConnection,
} from '@aws-sdk/client-ec2';
import { CreateVpcPeeringConnectionCommandOutput } from '@aws-sdk/client-ec2/dist-types/commands/CreateVpcPeeringConnectionCommand';
import { DescribeVpcPeeringConnectionsCommandOutput } from '@aws-sdk/client-ec2/dist-types/commands/DescribeVpcPeeringConnectionsCommand';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder2, paginateBuilder } from '../../../services/aws_macros';
import { updateTags } from '../../aws_ec2/mappers/tags';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { PeeringConnection, PeeringConnectionState, Route, RouteTable, Vpc } from '../entity';
import { eqTags } from './tags';

export class PeeringConnectionMapper extends MapperBase<PeeringConnection> {
  module: AwsVpcModule;
  entity = PeeringConnection;
  equals = (a: PeeringConnection, b: PeeringConnection) =>
    Object.is(a.requester.vpcId, b.requester.vpcId) &&
    Object.is(a.accepter.vpcId, b.accepter.vpcId) &&
    Object.is(a.state, b.state) &&
    eqTags(a.tags, b.tags);

  getPeeringConnections = paginateBuilder<EC2>(
    paginateDescribeVpcPeeringConnections,
    'VpcPeeringConnections',
  );

  deletePeeringConnection = crudBuilder2<EC2, 'deleteVpcPeeringConnection'>(
    'deleteVpcPeeringConnection',
    input => input,
  );

  private async waitForState(client: EC2, peeringConnectionId: string, desiredState: PeeringConnectionState) {
    let out: AwsPeeringConnection | undefined;
    await createWaiter<EC2, DescribeVpcPeeringConnectionsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 60,
        minDelay: 1,
        maxDelay: 4,
      },
      { VpcPeeringConnectionIds: [peeringConnectionId] },
      async (cl, cmd) => {
        const data: DescribeVpcPeeringConnectionsCommandOutput = await cl.describeVpcPeeringConnections(cmd);
        try {
          out = data.VpcPeeringConnections?.pop();
          if ((out?.Status?.Code as PeeringConnectionState) !== desiredState) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
    return out;
  }

  private async createPeeringConnection(
    requesterClient: EC2,
    accepterClient: EC2,
    input: CreateVpcPeeringConnectionCommandInput,
  ) {
    const res: CreateVpcPeeringConnectionCommandOutput = await requesterClient.createVpcPeeringConnection(
      input,
    );

    let out: AwsPeeringConnection | undefined;
    out = await this.waitForState(
      requesterClient,
      res.VpcPeeringConnection?.VpcPeeringConnectionId ?? '',
      PeeringConnectionState.PENDING_ACCEPTANCE,
    );

    await accepterClient.acceptVpcPeeringConnection({
      VpcPeeringConnectionId: out?.VpcPeeringConnectionId,
    });
    out = await this.waitForState(
      requesterClient,
      res.VpcPeeringConnection?.VpcPeeringConnectionId ?? '',
      PeeringConnectionState.ACTIVE,
    );

    return out;
  }

  async peeringConnectionMapper(peeringConnection: AwsPeeringConnection, ctx: Context) {
    const out = new PeeringConnection();
    if (!peeringConnection.RequesterVpcInfo?.VpcId || !peeringConnection.AccepterVpcInfo?.VpcId)
      return undefined;

    out.peeringConnectionId = peeringConnection.VpcPeeringConnectionId;
    try {
      out.requester = await this.getVpcByIdAndRegion(
        ctx,
        peeringConnection.RequesterVpcInfo!.VpcId!,
        peeringConnection.RequesterVpcInfo!.Region!,
      );
      out.accepter = await this.getVpcByIdAndRegion(
        ctx,
        peeringConnection.AccepterVpcInfo!.VpcId!,
        peeringConnection.AccepterVpcInfo!.Region!,
      );
    } catch (e: any) {
      // accepter or requester vpc no longer exist
      return undefined;
    }
    out.state = peeringConnection.Status?.Code as PeeringConnectionState;
    out.tags = this.convertTagsFromAws(peeringConnection.Tags);

    return out;
  }

  private convertTagsFromAws(inputTags?: Tag[]) {
    const tags: { [key: string]: any } = {};
    (inputTags || [])
      .filter(t => t.hasOwnProperty('Key') && t.hasOwnProperty('Value'))
      .forEach(t => {
        tags[t.Key as string] = t.Value;
      });
    return tags;
  }

  private convertTagsForAws(tags: { [key: string]: string }) {
    return Object.keys(tags).map(k => {
      return {
        Key: k,
        Value: tags[k],
      };
    });
  }

  private async getVpcByIdAndRegion(ctx: Context, vpcId: string, region: string) {
    return (
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId, region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId, region })))
    );
  }

  cloud: Crud2<PeeringConnection> = new Crud2({
    create: async (es: PeeringConnection[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const region = e.requester.region;
        const client = (await ctx.getAwsClient(region)) as AWS;

        const input: CreateVpcPeeringConnectionCommandInput = {
          VpcId: e.requester.vpcId,
          PeerVpcId: e.accepter.vpcId,
          PeerRegion: e.accepter.region,
        };
        if (e.tags !== undefined && e.tags !== null) {
          input.TagSpecifications = [
            {
              ResourceType: 'vpc-peering-connection',
              Tags: this.convertTagsForAws(e.tags),
            },
          ];
        }

        const res: AwsPeeringConnection | undefined = await this.createPeeringConnection(
          client.ec2client,
          (
            await ctx.getAwsClient(e.accepter.region)
          ).ec2client,
          input,
        );
        if (!res || !res.VpcPeeringConnectionId) continue;
        await this.createTwoWayRoutes(e.requester, e.accepter, res.VpcPeeringConnectionId, ctx);

        const newPeeringConnection = await this.peeringConnectionMapper(res, ctx);
        if (!newPeeringConnection) continue;

        if (e.id) {
          newPeeringConnection.id = e.id;
          await this.module.peeringConnection.db.update(newPeeringConnection, ctx);
        }
        out.push(newPeeringConnection);
      }

      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      const out: PeeringConnection[] = [];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          for (const peeringConnection of await this.getPeeringConnections(client.ec2client)) {
            if (
              peeringConnection?.Status?.Code === 'deleted' ||
              peeringConnection?.Status?.Code === 'deleting'
            )
              continue;

            const outPeeringConnection = await this.peeringConnectionMapper(peeringConnection, ctx);
            if (outPeeringConnection) out.push(outPeeringConnection);
          }
        }),
      );

      if (!!id) {
        return out.find(pc => pc.peeringConnectionId === id);
      }

      return out;
    },
    update: async (es: PeeringConnection[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.requester.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.PeeringConnection?.[this.entityId(e)];

        if (
          e.requester.vpcId !== cloudRecord.requester.vpcId ||
          e.accepter.vpcId !== cloudRecord.accepter.vpcId
        ) {
          // replace
          const created = await this.module.peeringConnection.cloud.create(e, ctx);
          await this.module.peeringConnection.cloud.delete(cloudRecord, ctx);
          if (!!created) {
            out.push(created as PeeringConnection);
          }
          continue;
        }

        if (!eqTags(e.tags, cloudRecord.tags)) {
          // update
          await updateTags(client.ec2client, e.peeringConnectionId ?? '', e.tags);
          out.push(e);
        } else if (e.state !== cloudRecord.state) {
          // state can't be pushed to the cloud, DB state to be replaced with the cloud value
          e.state = cloudRecord.state;
          await this.module.peeringConnection.db.update(e, ctx);
          out.push(cloudRecord);
        }
      }

      return out;
    },
    delete: async (es: PeeringConnection[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.requester.region)) as AWS;
        await this.deletePeeringConnection(client.ec2client, {
          VpcPeeringConnectionId: e.peeringConnectionId,
        });
      }
    },
    updateOrReplace: (a: PeeringConnection, b: PeeringConnection) => {
      if (a.accepter.vpcId !== b.accepter.vpcId || a.requester.vpcId !== b.requester.vpcId) return 'replace';
      return 'update';
    },
  });

  private async createTwoWayRoutes(
    requesterVpc: Vpc,
    accepterVpc: Vpc,
    vpcPeeringConnectionId: string,
    ctx: Context,
  ) {
    const routeTables: RouteTable[] = await this.module.routeTable.db.read(ctx);
    // create requester -> accepter route
    const requesterRouteTables = routeTables.filter(rt => rt.vpc.vpcId === requesterVpc.vpcId);
    for (const routeTable of requesterRouteTables) {
      const route = new Route();
      route.destination = accepterVpc.cidrBlock;
      route.vpcPeeringConnectionId = vpcPeeringConnectionId;
      route.routeTable = routeTable;
      await this.module.route.cloud.create(route, ctx);
    }
    // create accepter -> requester route
    const accepterRouteTables = routeTables.filter(rt => rt.vpc.vpcId === accepterVpc.vpcId);
    for (const routeTable of accepterRouteTables) {
      const route = new Route();
      route.destination = requesterVpc.cidrBlock;
      route.vpcPeeringConnectionId = vpcPeeringConnectionId;
      route.routeTable = routeTable;
      await this.module.route.cloud.create(route, ctx);
    }
  }

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
