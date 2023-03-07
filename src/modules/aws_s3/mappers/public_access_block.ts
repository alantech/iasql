import { PublicAccessBlockConfiguration as AwsPublicAccessBlock, S3 } from '@aws-sdk/client-s3';
import { GetPublicAccessBlockCommandInput } from '@aws-sdk/client-s3/dist-types/commands/GetPublicAccessBlockCommand';

import { AwsS3Module } from '..';
import { AWS, crudBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Bucket, PublicAccessBlock } from '../entity';

export class PublicAccessBlockMapper extends MapperBase<PublicAccessBlock> {
  module: AwsS3Module;
  entity = PublicAccessBlock;

  private async getPublicAccessBlockForBucket(ctx: Context, bucket: Bucket) {
    const client = (await ctx.getAwsClient(bucket.region)) as AWS;
    const result = await this.getPublicAccessBlock(client.s3Client, bucket.name);
    return this.publicAccessBlockMapper(result!.PublicAccessBlockConfiguration!, bucket);
  }

  publicAccessBlockMapper(rawPublicAccessBlock: AwsPublicAccessBlock, bucket: Bucket) {
    const out: PublicAccessBlock = new PublicAccessBlock();
    out.blockPublicAcls = rawPublicAccessBlock.BlockPublicAcls;
    out.ignorePublicAcls = rawPublicAccessBlock.IgnorePublicAcls;
    out.blockPublicPolicy = rawPublicAccessBlock.BlockPublicPolicy;
    out.restrictPublicBuckets = rawPublicAccessBlock.RestrictPublicBuckets;
    out.bucket = bucket;
    out.bucketName = bucket.name;
    return out;
  }

  equals = (a: PublicAccessBlock, b: PublicAccessBlock) =>
    a.blockPublicAcls === b.blockPublicAcls &&
    a.ignorePublicAcls === b.ignorePublicAcls &&
    a.blockPublicPolicy === b.blockPublicPolicy &&
    a.restrictPublicBuckets === b.restrictPublicBuckets;

  getPublicAccessBlock = crudBuilder<S3, 'getPublicAccessBlock'>('getPublicAccessBlock', bucketName => ({
    Bucket: bucketName,
  }));

  cloud = new Crud<PublicAccessBlock>({
    create: async (es: PublicAccessBlock[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        await this.savePublicAccessBlock(ctx, e);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const out: PublicAccessBlock[] = [];
      const buckets =
        ctx.memo?.cloud?.Bucket && Object.values(ctx.memo?.cloud?.Bucket).length
          ? Object.values(ctx.memo.cloud.Bucket)
          : await this.module.bucket.cloud.read(ctx);

      if (!!id) {
        const bucket = buckets.find((b: Bucket) => b.name === id);
        if (!bucket) throw new Error('No such bucket was found');
        return await this.getPublicAccessBlockForBucket(ctx, bucket);
      }

      await Promise.all(
        buckets.map(async (bucket: Bucket) => {
          try {
            const publicAccessBlock = await this.getPublicAccessBlockForBucket(ctx, bucket);
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
        await this.savePublicAccessBlock(ctx, e);
        out.push(e);
      }
      return out;
    },
    delete: async (es: PublicAccessBlock[], ctx: Context) => {
      const out: PublicAccessBlock[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.bucket.region)) as AWS;
        await client.s3Client.deletePublicAccessBlock({
          Bucket: e.bucketName,
        });
        out.push(e);
      }
      return out;
    },
  });

  private async savePublicAccessBlock(ctx: Context, e: PublicAccessBlock) {
    const client = (await ctx.getAwsClient(e.bucket.region)) as AWS;
    await client.s3Client.putPublicAccessBlock({
      Bucket: e.bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: e.blockPublicAcls,
        IgnorePublicAcls: e.ignorePublicAcls,
        BlockPublicPolicy: e.blockPublicPolicy,
        RestrictPublicBuckets: e.restrictPublicBuckets,
      },
    });
  }

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
