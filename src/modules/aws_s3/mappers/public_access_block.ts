import { PublicAccessBlockConfiguration as AwsPublicAccessBlock, S3 } from '@aws-sdk/client-s3';
import { GetPublicAccessBlockCommandInput } from '@aws-sdk/client-s3/dist-types/commands/GetPublicAccessBlockCommand';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2 } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Bucket, PublicAccessBlock } from '../entity';

export class PublicAccessBlockMapper extends MapperBase<PublicAccessBlock> {
  module: AwsS3Module;
  entity = PublicAccessBlock;

  private async getPublicAccessBlockForBucket(ctx: Context, bucket: Bucket) {
    const client = (await ctx.getAwsClient(bucket.region)) as AWS;
    const input: GetPublicAccessBlockCommandInput = {
      Bucket: bucket.name,
    };
    const result = await this.getPublicAccessBlock(client.s3Client, input);
    return this.publicAccessBlockMapper(result!.PublicAccessBlockConfiguration!, bucket);
  }

  publicAccessBlockMapper(rawPublicAccessBlock: AwsPublicAccessBlock, bucket: Bucket) {
    const out: PublicAccessBlock = new PublicAccessBlock();
    out.BlockPublicAcls = rawPublicAccessBlock.BlockPublicAcls;
    out.IgnorePublicAcls = rawPublicAccessBlock.IgnorePublicAcls;
    out.BlockPublicPolicy = rawPublicAccessBlock.BlockPublicPolicy;
    out.RestrictPublicBuckets = rawPublicAccessBlock.RestrictPublicBuckets;
    out.bucket = bucket;
    out.bucketName = bucket.name;
    return out;
  }

  equals = (a: PublicAccessBlock, b: PublicAccessBlock) =>
    a.BlockPublicAcls === b.BlockPublicAcls &&
    a.IgnorePublicAcls === b.IgnorePublicAcls &&
    a.BlockPublicPolicy === b.BlockPublicPolicy &&
    a.RestrictPublicBuckets === b.RestrictPublicBuckets;

  getPublicAccessBlock = crudBuilder2<S3, 'getPublicAccessBlock'>('getPublicAccessBlock', input => input);

  cloud = new Crud2<PublicAccessBlock>({
    create: async (es: PublicAccessBlock[], ctx: Context) => {
      // can't create two public access blocks for a bucket
      await this.module.publicAccessBlock.db.delete(es, ctx);
      return [];
    },
    read: async (ctx: Context, id?: string) => {
      const out: PublicAccessBlock[] = [];
      const buckets =
        ctx.memo?.cloud?.Bucket && Object.values(ctx.memo?.cloud?.Bucket).length
          ? Object.values(ctx.memo?.cloud?.Bucket)
          : await this.module.bucket.cloud.read(ctx);

      if (!!id) {
        const bucket = buckets.find((b: Bucket) => b.name === id);
        return await this.getPublicAccessBlockForBucket(ctx, bucket);
      }

      await Promise.all(
        buckets.map(async (bucket: Bucket) => {
          let publicAccessBlock;
          try {
            publicAccessBlock = await this.getPublicAccessBlockForBucket(ctx, bucket);
            out.push(publicAccessBlock);
          } catch (_) {
            // it'll raise in case there's no public access block
          }
        }),
      );
      return out;
    },
    updateOrReplace: () => 'update',
    update: async (es: PublicAccessBlock[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.bucket.region)) as AWS;
        await client.s3Client.putPublicAccessBlock({
          Bucket: e.bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: e.BlockPublicAcls,
            IgnorePublicAcls: e.IgnorePublicAcls,
            BlockPublicPolicy: e.BlockPublicPolicy,
            RestrictPublicBuckets: e.RestrictPublicBuckets,
          },
        });
        out.push(e);
      }
      return out;
    },
    delete: async (es: PublicAccessBlock[], ctx: Context) => {
      // can't delete it manually, the bucket should be removed
      const out = await this.module.publicAccessBlock.db.create(es, ctx);
      if (!out || out instanceof Array) return out;
      return [out];
    },
  });

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
