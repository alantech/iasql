import {
  EC2,
  Tag,
  Vpc as AwsVpc,
  paginateDescribeVpcs,
  CreateVpcCommandInput,
  DescribeVpcsCommandInput,
} from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { Vpc, VpcState, Subnet } from '../entity';
import { AwsVpcModule } from '..';
import { eqTags, updateTags } from './tags';

export class VpcMapper extends MapperBase<Vpc> {
  module: AwsVpcModule;
  entity = Vpc;
  equals = (a: Vpc, b: Vpc) => {
    const result =
      Object.is(a.cidrBlock, b.cidrBlock) &&
      Object.is(a.state, b.state) &&
      Object.is(a.isDefault, b.isDefault) &&
      eqTags(a.tags, b.tags);
    return result;
  };

  vpcMapper(vpc: AwsVpc) {
    const out = new Vpc();
    if (!vpc?.VpcId || !vpc?.CidrBlock) return undefined;
    out.vpcId = vpc.VpcId;
    out.cidrBlock = vpc.CidrBlock;
    out.state = vpc.State as VpcState;
    out.isDefault = vpc.IsDefault ?? false;
    const tags: { [key: string]: any } = {};
    (vpc.Tags || [])
      .filter(t => t.hasOwnProperty('Key') && t.hasOwnProperty('Value'))
      .forEach(t => {
        tags[t.Key as string] = t.Value;
      });
    out.tags = tags;

    return out;
  }

  async createVpc(client: EC2, input: CreateVpcCommandInput) {
    const res = await client.createVpc(input);
    const describeInput: DescribeVpcsCommandInput = {
      VpcIds: [res.Vpc?.VpcId ?? ''],
    };
    let out: AwsVpc | undefined;
    await createWaiter<EC2, DescribeVpcsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (cl, cmd) => {
        const data = await cl.describeVpcs(cmd);
        try {
          out = data.Vpcs?.pop();
          // If it is not a final state we retry
          if ([VpcState.PENDING].includes(out?.State as VpcState)) {
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

  getVpc = crudBuilderFormat<EC2, 'describeVpcs', AwsVpc | undefined>(
    'describeVpcs',
    id => ({ VpcIds: [id] }),
    res => res?.Vpcs?.[0],
  );
  getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
  deleteVpc = crudBuilder2<EC2, 'deleteVpc'>('deleteVpc', input => input);

  cloud: Crud2<Vpc> = new Crud2({
    updateOrReplace: (a: Vpc, b: Vpc) => {
      if (!Object.is(a.cidrBlock, b.cidrBlock) || !Object.is(a.isDefault, b.isDefault)) return 'replace';
      else return 'update';
    },
    create: async (es: Vpc[], ctx: Context) => {
      // TODO: Add support for creating default VPCs (only one is allowed, also add constraint
      // that a single VPC is set as default)
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        let tgs: Tag[] = [];
        if (e.tags !== undefined && e.tags !== null) {
          const tags: { [key: string]: string } = e.tags;
          tgs = Object.keys(tags).map(k => {
            return {
              Key: k,
              Value: tags[k],
            };
          });
        }

        const input: CreateVpcCommandInput = {
          CidrBlock: e.cidrBlock,
        };

        if (tgs.length > 0) {
          input.TagSpecifications = [
            {
              ResourceType: 'vpc',
              Tags: tgs,
            },
          ];
        }
        const res: AwsVpc | undefined = await this.createVpc(client.ec2client, input);
        if (res) {
          const newVpc = this.vpcMapper(res);
          if (!newVpc) continue;
          newVpc.id = e.id;
          await this.module.vpc.db.update(newVpc, ctx);
          out.push(newVpc);
        }
      }

      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (!!id) {
        const rawVpc = await this.getVpc(client.ec2client, id);
        if (!rawVpc) return;
        return this.vpcMapper(rawVpc);
      } else {
        const out = [];
        for (const vpc of await this.getVpcs(client.ec2client)) {
          const outVpc = this.vpcMapper(vpc);
          if (outVpc) out.push(outVpc);
        }
        return out;
      }
    },
    update: async (es: Vpc[], ctx: Context) => {
      // if user has modified state, restore it. If not, go with replace path
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Vpc?.[e.vpcId ?? ''];
        if (!Object.is(e.state, cloudRecord.state)) {
          // Restore record
          cloudRecord.id = e.id;
          await this.module.vpc.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          const isUpdate = Object.is(this.module.vpc.cloud.updateOrReplace(cloudRecord, e), 'update');
          if (!isUpdate) {
            // if CIDR is different we do the create
            const newVpc = await this.module.vpc.cloud.create(e, ctx);
            out.push(newVpc);
          } else {
            if (!eqTags(e.tags, cloudRecord.tags) && e.vpcId) {
              await updateTags(client.ec2client, e.vpcId, e.tags);
            }
            out.push(e);
          }
        }
      }
      return out;
    },
    delete: async (es: Vpc[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        // Special behavior here. You're not allowed to mess with the "default" VPC.
        // Any attempt to update it is instead turned into *restoring* the value in
        // the database to match the cloud value
        if (e.isDefault) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          await this.module.vpc.db.update(e, ctx);
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.Vpc[e.vpcId ?? ''] = e;
          const subnets = ctx?.memo?.cloud?.Subnet ?? [];
          const relevantSubnets = subnets.filter((s: Subnet) => s.vpc.vpcId === e.vpcId);
          if (relevantSubnets.length > 0) {
            await this.module.subnet.db.update(relevantSubnets, ctx);
          }
        } else {
          await this.deleteVpc(client.ec2client, {
            VpcId: e.vpcId,
          });
        }
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
