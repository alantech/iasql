import {
  CreateVpcCommandInput,
  DescribeVpcAttributeCommandOutput,
  DescribeVpcsCommandInput,
  EC2,
  paginateDescribeVpcs,
  Tag,
  Vpc as AwsVpc,
  VpcAttributeName,
} from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { RouteTable, RouteTableAssociation, Subnet, Vpc, VpcState } from '../entity';
import { eqTags, updateTags } from './tags';

export class VpcMapper extends MapperBase<Vpc> {
  module: AwsVpcModule;
  entity = Vpc;
  equals = (a: Vpc, b: Vpc) => {
    const result =
      Object.is(a.cidrBlock, b.cidrBlock) &&
      Object.is(a.state, b.state) &&
      Object.is(a.isDefault, b.isDefault) &&
      (a.isDefault ||
        (Object.is(a.enableDnsHostnames, b.enableDnsHostnames) &&
          Object.is(a.enableDnsSupport, b.enableDnsSupport) &&
          Object.is(a.enableNetworkAddressUsageMetrics, b.enableNetworkAddressUsageMetrics))) &&
      eqTags(a.tags, b.tags) &&
      Object.is(a.dhcpOptions?.dhcpOptionsId, b.dhcpOptions?.dhcpOptionsId);
    return result;
  };

  async vpcMapper(vpc: AwsVpc, region: string, ctx: Context) {
    const client = (await ctx.getAwsClient(region)) as AWS;

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
    out.region = region;

    // query for vpc attributes
    if (!vpc.IsDefault) {
      out.enableDnsHostnames =
        (await this.getVpcAttribute(client.ec2client, out.vpcId, VpcAttributeName.enableDnsHostnames))
          ?.EnableDnsHostnames?.Value ?? false;
      out.enableDnsSupport =
        (await this.getVpcAttribute(client.ec2client, out.vpcId, VpcAttributeName.enableDnsSupport))
          ?.EnableDnsSupport?.Value ?? false;
      out.enableNetworkAddressUsageMetrics =
        (
          await this.getVpcAttribute(
            client.ec2client,
            out.vpcId,
            VpcAttributeName.enableNetworkAddressUsageMetrics,
          )
        )?.EnableNetworkAddressUsageMetrics?.Value ?? false;
    } else {
      out.enableDnsHostnames = false;
      out.enableDnsSupport = false;
      out.enableNetworkAddressUsageMetrics = false;
    }

    if (vpc.DhcpOptionsId && vpc.DhcpOptionsId !== 'default') {
      // we encapsulate because it may not exist as existence is not validated by AWS
      out.dhcpOptions =
        (await this.module.dhcpOptions.db.read(
          ctx,
          this.module.dhcpOptions.generateId({ dhcpOptionsId: vpc.DhcpOptionsId, region }),
        )) ??
        (await this.module.dhcpOptions.cloud.read(
          ctx,
          this.module.dhcpOptions.generateId({ dhcpOptionsId: vpc.DhcpOptionsId, region }),
        ));
    }

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

  getVpcAttribute = crudBuilderFormat<
    EC2,
    'describeVpcAttribute',
    DescribeVpcAttributeCommandOutput | undefined
  >(
    'describeVpcAttribute',
    (id, attribute) => ({ VpcId: id, Attribute: attribute }),
    res => res,
  );

  getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
  deleteVpc = crudBuilder<EC2, 'deleteVpc'>('deleteVpc', input => input);

  associateDhcpOptions = crudBuilder<EC2, 'associateDhcpOptions'>(
    'associateDhcpOptions',
    (dhcpOptionsId: string, vpcId: string) => ({
      DhcpOptionsId: dhcpOptionsId,
      VpcId: vpcId,
    }),
  );

  async updateVpcAttribute(
    client: EC2,
    vpcId: string,
    enableDnsHostnames: boolean | undefined,
    enableDnsSupport: boolean | undefined,
    enableNetworkAddressUsageMetrics: boolean | undefined,
  ) {
    if (enableDnsHostnames !== undefined) {
      await client.modifyVpcAttribute({ VpcId: vpcId, EnableDnsHostnames: { Value: enableDnsHostnames } });
    }
    if (enableDnsSupport !== undefined) {
      await client.modifyVpcAttribute({ VpcId: vpcId, EnableDnsSupport: { Value: enableDnsSupport } });
    }
    if (enableNetworkAddressUsageMetrics !== undefined) {
      await client.modifyVpcAttribute({
        VpcId: vpcId,
        EnableNetworkAddressUsageMetrics: { Value: enableNetworkAddressUsageMetrics },
      });
    }
  }

  cloud: Crud<Vpc> = new Crud({
    updateOrReplace: (a: Vpc, b: Vpc) => {
      if (!Object.is(a.cidrBlock, b.cidrBlock) || !Object.is(a.isDefault, b.isDefault)) return 'replace';
      else return 'update';
    },
    create: async (es: Vpc[], ctx: Context) => {
      // TODO: Add support for creating default VPCs (only one is allowed, also add constraint
      // that a single VPC is set as default)
      const out = [];
      for (const e of es) {
        console.log('i create vpc');
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
        console.log('after i create vpc');
        console.log(res);
        if (res) {
          // also update the vpc attributes if they are not the default
          // doing on the same run because if we wait for taking it on the loop, users can trigger endpoint creation
          // without actually having the right vpc attributes
          if (
            res.VpcId &&
            !e.isDefault &&
            (e.enableDnsHostnames || e.enableDnsSupport || e.enableNetworkAddressUsageMetrics)
          ) {
            await this.updateVpcAttribute(
              client.ec2client,
              res.VpcId,
              e.enableDnsHostnames,
              e.enableDnsSupport,
              e.enableNetworkAddressUsageMetrics,
            );
          }
          const newVpc = await this.vpcMapper(res, e.region, ctx);
          if (!newVpc) continue;
          newVpc.id = e.id;

          // if provided dhcp options are not the same as the defaults one, we need to associate the right ones
          if (
            e.dhcpOptions?.dhcpOptionsId &&
            newVpc.dhcpOptions?.dhcpOptionsId !== e.dhcpOptions?.dhcpOptionsId
          ) {
            await this.associateDhcpOptions(client.ec2client, e.dhcpOptions?.dhcpOptionsId, newVpc.vpcId);
            newVpc.dhcpOptions = e.dhcpOptions;
          }
          await this.module.vpc.db.update(newVpc, ctx);
          out.push(newVpc);
        }
      }
      console.log('after');

      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { vpcId, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawVpc = await this.getVpc(client.ec2client, vpcId);
          if (rawVpc) return await this.vpcMapper(rawVpc, region, ctx);
        }
      } else {
        const out: Vpc[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const vpc of await this.getVpcs(client.ec2client)) {
              const outVpc = await this.vpcMapper(vpc, region, ctx);
              if (outVpc) out.push(outVpc);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: Vpc[], ctx: Context) => {
      // if user has modified state, restore it. If not, go with replace path
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.Vpc?.[this.entityId(e)];
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

            // check attributes
            if (e.vpcId) {
              if (
                !Object.is(e.enableDnsHostnames, cloudRecord.enableDnsHostnames) ||
                !Object.is(e.enableDnsSupport, cloudRecord.enableDnsSupport) ||
                !Object.is(e.enableNetworkAddressUsageMetrics, cloudRecord.enableNetworkAddressUsageMetrics)
              ) {
                await this.updateVpcAttribute(
                  client.ec2client,
                  e.vpcId,
                  e.enableDnsHostnames,
                  e.enableDnsSupport,
                  e.enableNetworkAddressUsageMetrics,
                );
              }
            }

            // if provided dhcp options are not the same as the defaults one, we need to associate the right ones
            if (e.dhcpOptions?.dhcpOptionsId !== cloudRecord.dhcpOptions?.dhcpOptionsId) {
              let optionId;
              if (!e.dhcpOptions) optionId = 'default';
              else optionId = e.dhcpOptions.dhcpOptionsId;
              await this.associateDhcpOptions(client.ec2client, optionId, e.vpcId);
            }

            out.push(e);
          }
        }
      }
      return out;
    },
    delete: async (es: Vpc[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Special behavior here. You're not allowed to mess with the "default" VPC.
        // Any attempt to update it is instead turned into *restoring* the value in
        // the database to match the cloud value
        if (e.isDefault) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          await this.module.vpc.db.update(e, ctx);
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.Vpc[this.entityId(e)] = e;
          const subnets: Subnet[] = await this.module.subnet.cloud.read(ctx);
          const relevantSubnets = subnets.filter(
            (s: Subnet) => s.vpc.vpcId === e.vpcId && s.region === e.region,
          );
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
