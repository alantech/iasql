import {
  CreateNatGatewayCommandInput,
  DescribeNatGatewaysCommandInput,
  EC2,
  NatGateway as AwsNatGateway,
  NatGatewayState as AwsNatGatewayState,
  Tag,
  paginateDescribeNatGateways,
} from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { ElasticIp, NatGateway, NatGatewayState, ConnectivityType } from '../entity';
import { AwsVpcModule } from '..';
import { eqTags, updateTags } from './tags';

export class NatGatewayMapper extends MapperBase<NatGateway> {
  module: AwsVpcModule;
  entity = NatGateway;
  equals = (a: NatGateway, b: NatGateway) =>
    Object.is(a.connectivityType, b.connectivityType) &&
    Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId) &&
    Object.is(a.state, b.state) &&
    Object.is(a.subnet?.subnetArn, b.subnet?.subnetArn) &&
    eqTags(a.tags, b.tags);

  async natGatewayMapper(nat: AwsNatGateway, ctx: Context) {
    const out = new NatGateway();
    out.connectivityType = nat.ConnectivityType as ConnectivityType;
    const natPublicAddress = nat.NatGatewayAddresses?.filter(n => !!n.AllocationId).pop();
    if (natPublicAddress?.AllocationId) {
      try {
        out.elasticIp =
          (await this.module.elasticIp.db.read(ctx, natPublicAddress.AllocationId)) ??
          (await this.module.elasticIp.cloud.read(ctx, natPublicAddress.AllocationId));
      } catch (error: any) {
        if (error.Code === 'InvalidAllocationID.NotFound') return undefined;
      }
      if (!out.elasticIp) throw new Error('Not valid elastic ip, yet?');
    }
    out.natGatewayId = nat.NatGatewayId;
    out.state = nat.State as NatGatewayState;
    out.subnet =
      (await this.module.subnet.db.read(ctx, nat.SubnetId)) ?? (await this.module.subnet.cloud.read(ctx, nat.SubnetId));
    if (nat.SubnetId && !out.subnet) return undefined;
    const tags: { [key: string]: string } = {};
    (nat.Tags || [])
      .filter(t => !!t.Key && !!t.Value)
      .forEach(t => {
        tags[t.Key as string] = t.Value as string;
      });
    out.tags = tags;
    return out;
  }

  getNatGateway = crudBuilderFormat<EC2, 'describeNatGateways', AwsNatGateway | undefined>(
    'describeNatGateways',
    id => ({
      NatGatewayIds: [id],
      Filter: [
        {
          Name: 'state',
          Values: [AwsNatGatewayState.AVAILABLE, AwsNatGatewayState.FAILED],
        },
      ],
    }),
    res => res?.NatGateways?.pop()
  );
  getNatGateways = paginateBuilder<EC2>(paginateDescribeNatGateways, 'NatGateways', undefined, undefined, () => ({
    Filter: [
      {
        Name: 'state',
        Values: [AwsNatGatewayState.AVAILABLE, AwsNatGatewayState.FAILED],
      },
    ],
  }));

  // TODO: Add a waiter macro
  async createNatGateway(client: EC2, input: CreateNatGatewayCommandInput) {
    let out: AwsNatGateway | undefined;
    const res = await client.createNatGateway(input);
    out = res.NatGateway;
    const describeInput: DescribeNatGatewaysCommandInput = {
      NatGatewayIds: [res.NatGateway?.NatGatewayId ?? ''],
    };
    await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (cl, cmd) => {
        const data = await cl.describeNatGateways(cmd);
        try {
          out = data.NatGateways?.pop();
          // If it is not a final state we retry
          if ([AwsNatGatewayState.DELETING, AwsNatGatewayState.PENDING].includes(out?.State as AwsNatGatewayState)) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      }
    );
    return out;
  }
  async deleteNatGateway(client: EC2, id: string) {
    await client.deleteNatGateway({
      NatGatewayId: id,
    });
    const describeInput: DescribeNatGatewaysCommandInput = {
      NatGatewayIds: [id ?? ''],
    };
    await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (cl, cmd) => {
        const data = await cl.describeNatGateways(cmd);
        try {
          const nat = data.NatGateways?.pop();
          // If it is not a final state we retry
          if ([AwsNatGatewayState.DELETING, AwsNatGatewayState.PENDING].includes(nat?.State as AwsNatGatewayState)) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      }
    );
  }

  cloud: Crud2<NatGateway> = new Crud2({
    create: async (es: NatGateway[], ctx: Context) => {
      const out = [];
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const input: CreateNatGatewayCommandInput = {
          SubnetId: e.subnet?.subnetId,
          ConnectivityType: e.connectivityType,
        };
        if (e.tags && Object.keys(e.tags).length) {
          const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
            return {
              Key: k,
              Value: e.tags![k],
            };
          });
          input.TagSpecifications = [
            {
              ResourceType: 'natgateway',
              Tags: tags,
            },
          ];
        }
        if (e.elasticIp) {
          input.AllocationId = e.elasticIp.allocationId;
          if (!input.AllocationId) throw new Error('Elastic ip need to be created first');
        } else if (!e.elasticIp && e.connectivityType === ConnectivityType.PUBLIC) {
          const elasticIp = new ElasticIp();
          // Attach the same tags in case we want to associate them visualy through the AWS Console
          elasticIp.tags = e.tags;
          const newElasticIp = await this.module.elasticIp.cloud.create(elasticIp, ctx);
          if (!newElasticIp || newElasticIp instanceof Array) continue;
          input.AllocationId = newElasticIp.allocationId;
        }
        const res: AwsNatGateway | undefined = await this.createNatGateway(client.ec2client, input);
        if (res) {
          const newNatGateway = await this.natGatewayMapper(res, ctx);
          if (!newNatGateway) continue;
          newNatGateway.id = e.id;
          await this.module.natGateway.db.update(newNatGateway, ctx);
          out.push(newNatGateway);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (!!id) {
        const rawNatGateway = await this.getNatGateway(client.ec2client, id);
        if (!rawNatGateway) return;
        return await this.natGatewayMapper(rawNatGateway, ctx);
      } else {
        const out = [];
        for (const ng of await this.getNatGateways(client.ec2client)) {
          const outNg = await this.natGatewayMapper(ng, ctx);
          if (outNg) out.push(outNg);
        }
        return out;
      }
    },
    updateOrReplace: (a: NatGateway, b: NatGateway) => {
      if (
        !(Object.is(a.state, b.state) && eqTags(a.tags, b.tags)) &&
        Object.is(a.connectivityType, b.connectivityType) &&
        Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId) &&
        Object.is(a.subnet?.subnetId, b.subnet?.subnetId)
      )
        return 'update';
      return 'replace';
    },
    update: async (es: NatGateway[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.NatGateway?.[e.natGatewayId ?? ''];
        // `isUpdate` means only `tags` and/or `state` have changed
        const isUpdate = Object.is(this.module.natGateway.cloud.updateOrReplace(cloudRecord, e), 'update');
        if (isUpdate && !eqTags(cloudRecord.tags, e.tags)) {
          // If `tags` have changed, no matter if `state` changed or not, we update the tags, call AWS and update the DB
          await updateTags(client.ec2client, e.natGatewayId ?? '', e.tags);
          const rawNatGateway = await this.getNatGateway(client.ec2client, e.natGatewayId ?? '');
          if (!rawNatGateway) continue;
          const updatedNatGateway = await this.natGatewayMapper(rawNatGateway, ctx);
          if (!updatedNatGateway) continue;
          updatedNatGateway.id = e.id;
          await this.module.natGateway.db.update(updatedNatGateway, ctx);
          out.push(updatedNatGateway);
        } else if (isUpdate && eqTags(cloudRecord.tags, e.tags)) {
          // If `tags` have **not** changed, it means only `state` changed. This is the restore path. We do not call AWS again, just use the record we have in memo.
          cloudRecord.id = e.id;
          await this.module.natGateway.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          // Replace path
          // Need to delete first to make the elastic ip address available
          await this.module.natGateway.cloud.delete(cloudRecord, ctx);
          const newNatGateway = await this.module.natGateway.cloud.create(e, ctx);
          out.push(newNatGateway);
        }
      }
      return out;
    },
    delete: async (es: NatGateway[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteNatGateway(client.ec2client, e.natGatewayId ?? '');
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
