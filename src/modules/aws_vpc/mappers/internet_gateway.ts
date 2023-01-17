import {
  CreateInternetGatewayCommandInput,
  EC2,
  InternetGateway as AwsInternetGateway,
  paginateDescribeInternetGateways,
} from '@aws-sdk/client-ec2';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { InternetGateway } from '../entity';
import { awsVpcModule, AwsVpcModule } from '../index';
import { convertTagsForAws, convertTagsFromAws, eqTags } from './tags';

export class InternetGatewayMapper extends MapperBase<InternetGateway> {
  module: AwsVpcModule;
  entity = InternetGateway;
  equals = (a: InternetGateway, b: InternetGateway) =>
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId) && eqTags(a.tags, b.tags);

  getInternetGateways = paginateBuilder<EC2>(paginateDescribeInternetGateways, 'InternetGateways');
  getInternetGateway = crudBuilderFormat<EC2, 'describeInternetGateways', AwsInternetGateway | undefined>(
    'describeInternetGateways',
    internetGatewayId => ({ InternetGatewayIds: [internetGatewayId] }),
    res => res?.InternetGateways?.pop(),
  );
  attachToVpc = crudBuilder2<EC2, 'attachInternetGateway'>(
    'attachInternetGateway',
    (internetGatewayId: string, vpcId: string) => ({
      InternetGatewayId: internetGatewayId,
      VpcId: vpcId,
    }),
  );
  detachVpc = crudBuilder2<EC2, 'detachInternetGateway'>(
    'detachInternetGateway',
    (internetGatewayId: string, vpcId: string) => ({
      InternetGatewayId: internetGatewayId,
      VpcId: vpcId,
    }),
  );
  deleteInternetGateway = crudBuilder2<EC2, 'deleteInternetGateway'>(
    'deleteInternetGateway',
    internetGatewayId => ({ InternetGatewayId: internetGatewayId }),
  );

  async createInternetGateway(client: EC2, tags?: { [key: string]: string }) {
    const input: CreateInternetGatewayCommandInput = {};

    const tgs = convertTagsForAws(tags ?? {});
    if (tgs.length > 0) {
      input.TagSpecifications = [
        {
          ResourceType: 'internet-gateway',
          Tags: tgs,
        },
      ];
    }

    return (await client.createInternetGateway(input)).InternetGateway;
  }

  async internetGatewayMapper(ig: AwsInternetGateway, region: string, ctx: Context) {
    const out = new InternetGateway();
    out.internetGatewayId = ig.InternetGatewayId;
    out.tags = convertTagsFromAws(ig.Tags);
    if (!!ig.Attachments && ig.Attachments.length)
      out.vpc =
        (await awsVpcModule.vpc.db.read(
          ctx,
          awsVpcModule.vpc.generateId({ vpcId: ig.Attachments[0].VpcId!, region }),
        )) ??
        (await awsVpcModule.vpc.cloud.read(
          ctx,
          awsVpcModule.vpc.generateId({ vpcId: ig.Attachments[0].VpcId!, region }),
        ));
    out.region = region;

    return out;
  }

  cloud: Crud2<InternetGateway> = new Crud2({
    create: async (es: InternetGateway[], ctx: Context) => {
      const out: InternetGateway[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        let rawInternetGateway = await this.createInternetGateway(client.ec2client, e.tags);
        if (!rawInternetGateway) continue;
        if (e.vpc && !!e.vpc.vpcId) {
          await this.attachToVpc(client.ec2client, rawInternetGateway.InternetGatewayId!, e.vpc.vpcId);
          // re-read rawInternetGateway to update vpc field
          rawInternetGateway = await this.getInternetGateway(
            client.ec2client,
            rawInternetGateway.InternetGatewayId,
          );
        }
        const internetGateway = await this.internetGatewayMapper(rawInternetGateway!, e.region, ctx);
        if (!internetGateway) continue;

        internetGateway.id = e.id;
        await this.module.internetGateway.db.update(internetGateway, ctx);
        out.push(internetGateway);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { internetGatewayId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawInternetGateway = await this.getInternetGateway(client.ec2client, internetGatewayId);
        if (!rawInternetGateway) return;
        return await this.internetGatewayMapper(rawInternetGateway, region, ctx);
      } else {
        const out: InternetGateway[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const rawInternetGateway of await this.getInternetGateways(client.ec2client)) {
              const internetGateway = await this.internetGatewayMapper(rawInternetGateway, region, ctx);
              if (!internetGateway) continue;
              out.push(internetGateway);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: InternetGateway[], ctx: Context) => {
      const out: InternetGateway[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord: InternetGateway = ctx?.memo?.cloud?.InternetGateway?.[this.entityId(e)];

        if (cloudRecord.vpc?.vpcId !== e.vpc?.vpcId) {
          if (cloudRecord.vpc && cloudRecord.vpc.vpcId)
            await this.detachVpc(client.ec2client, cloudRecord.internetGatewayId, cloudRecord.vpc.vpcId);
          if (e.vpc && e.vpc.vpcId)
            await this.attachToVpc(client.ec2client, cloudRecord.internetGatewayId, e.vpc.vpcId);
        }
        out.push(e);
      }
      return out;
    },
    delete: async (es: InternetGateway[], ctx: Context) => {
      await Promise.all(
        es.map(async e => {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          if (e.vpc && e.vpc.vpcId) {
            if (e.vpc.isDefault) {
              // don't delete the internet gateway associated with the default VPC
              await this.module.internetGateway.db.update(e, ctx);
              // Make absolutely sure it shows up in the memo
              ctx.memo.db.InternetGateway[this.entityId(e)] = e;
              return;
            }
            await this.detachVpc(client.ec2client, e.internetGatewayId!, e.vpc?.vpcId);
          }
          await this.deleteInternetGateway(client.ec2client, e.internetGatewayId);
        }),
      );
    },
    updateOrReplace: () => 'update',
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
