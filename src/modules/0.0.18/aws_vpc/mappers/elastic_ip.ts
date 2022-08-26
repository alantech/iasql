import { Address, AllocateAddressCommandInput, EC2, Tag } from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { ElasticIp } from '../entity';
import { eqTags, updateTags } from './tags';

export class ElasticIpMapper extends MapperBase<ElasticIp> {
  module: AwsVpcModule;
  entity = ElasticIp;
  equals = (a: ElasticIp, b: ElasticIp) => Object.is(a.publicIp, b.publicIp) && eqTags(a.tags, b.tags);

  elasticIpMapper(eip: Address) {
    const out = new ElasticIp();
    out.allocationId = eip.AllocationId;
    if (!out.allocationId) return undefined;
    out.publicIp = eip.PublicIp;
    const tags: { [key: string]: string } = {};
    (eip.Tags || [])
      .filter((t: any) => !!t.Key && !!t.Value)
      .forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
    out.tags = tags;
    return out;
  }

  getElasticIp = crudBuilderFormat<EC2, 'describeAddresses', Address | undefined>(
    'describeAddresses',
    allocationId => ({ AllocationIds: [allocationId] }),
    res => res?.Addresses?.pop()
  );
  getAllIps = crudBuilder2<EC2, 'describeAddresses'>('describeAddresses', () => ({}));
  getElasticIps = async (client: EC2) =>
    (await this.getAllIps(client))?.Addresses?.filter(a => !!a.AllocationId) ?? [];
  deleteElasticIp = crudBuilder2<EC2, 'releaseAddress'>('releaseAddress', AllocationId => ({ AllocationId }));

  // TODO: Why does this have tags baked in automatically?
  async createElasticIp(client: EC2, tags?: { [key: string]: string }) {
    const allocateAddressCommandInput: AllocateAddressCommandInput = {
      Domain: 'vpc',
    };
    if (tags) {
      let tgs: Tag[] = [];
      tgs = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
      allocateAddressCommandInput.TagSpecifications = [
        {
          ResourceType: 'elastic-ip',
          Tags: tgs,
        },
      ];
    }
    return await client.allocateAddress(allocateAddressCommandInput);
  }

  cloud = new Crud2({
    create: async (es: ElasticIp[], ctx: Context) => {
      const out = [];
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const res = await this.createElasticIp(client.ec2client, e.tags);
        const rawElasticIp = await this.getElasticIp(client.ec2client, res.AllocationId ?? '');
        if (!rawElasticIp) continue;
        const newElasticIp = this.elasticIpMapper(rawElasticIp);
        if (!newElasticIp) continue;
        newElasticIp.id = e.id;
        await this.module.elasticIp.db.update(newElasticIp, ctx);
        out.push(newElasticIp);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (!!id) {
        const rawElasticIp = await this.getElasticIp(client.ec2client, id);
        if (!rawElasticIp) return;
        return this.elasticIpMapper(rawElasticIp);
      } else {
        const out = [];
        for (const eip of await this.getElasticIps(client.ec2client)) {
          const outEip = this.elasticIpMapper(eip);
          if (outEip) out.push(outEip);
        }
        return out;
      }
    },
    update: async (es: ElasticIp[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      // Elastic ip properties cannot be updated other than tags.
      // If the public ip is updated we just restor it
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.ElasticIp?.[e.allocationId ?? ''];
        if (e.tags && !eqTags(cloudRecord.tags, e.tags)) {
          await updateTags(client.ec2client, e.allocationId ?? '', e.tags);
          const rawElasticIp = await this.getElasticIp(client.ec2client, e.allocationId ?? '');
          if (!rawElasticIp) continue;
          const newElasticIp = this.elasticIpMapper(rawElasticIp);
          if (!newElasticIp) continue;
          newElasticIp.id = e.id;
          await this.module.elasticIp.db.update(newElasticIp, ctx);
          // Push
          out.push(newElasticIp);
          continue;
        }
        cloudRecord.id = e.id;
        await this.module.elasticIp.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: ElasticIp[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteElasticIp(client.ec2client, e.allocationId ?? '');
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
