import { S3 } from '@aws-sdk/client-s3';
import { GetBucketWebsiteCommandInput } from '@aws-sdk/client-s3/dist-types/commands/GetBucketWebsiteCommand';
import { GetBucketWebsiteOutput } from '@aws-sdk/client-s3/dist-types/models/models_0';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2 } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Bucket, BucketWebsite } from '../entity';

export class BucketWebsiteMapper extends MapperBase<BucketWebsite> {
  module: AwsS3Module;
  entity = BucketWebsite;

  private async getBucketWebsiteForBucket(ctx: Context, bucket: Bucket) {
    const client = (await ctx.getAwsClient(bucket.region)) as AWS;
    const input: GetBucketWebsiteCommandInput = {
      Bucket: bucket.name,
    };
    const result = await this.getBucketWebsite(client.s3Client, input);
    return this.bucketWebsiteMapper(result!, bucket);
  }

  bucketWebsiteMapper(rawBucketWebsite: GetBucketWebsiteOutput, bucket: Bucket) {
    const out: BucketWebsite = new BucketWebsite();
    out.indexDocument = rawBucketWebsite.IndexDocument?.Suffix!;
    out.errorDocument = rawBucketWebsite.ErrorDocument?.Key;
    out.bucket = bucket;
    out.bucketName = bucket.name;
    return out;
  }

  equals = (a: BucketWebsite, b: BucketWebsite) =>
    a.indexDocument === b.indexDocument && a.errorDocument === b.errorDocument;

  getBucketWebsite = crudBuilder2<S3, 'getBucketWebsite'>('getBucketWebsite', input => input);

  cloud = new Crud2<BucketWebsite>({
    create: async (es: BucketWebsite[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        await this.saveBucketWebsite(ctx, e);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const out: BucketWebsite[] = [];
      const buckets =
        ctx.memo?.cloud?.Bucket && Object.values(ctx.memo?.cloud?.Bucket).length
          ? Object.values(ctx.memo?.cloud?.Bucket)
          : await this.module.bucket.cloud.read(ctx);

      if (!!id) {
        const bucket = buckets.find((b: Bucket) => b.name === id);
        return await this.getBucketWebsiteForBucket(ctx, bucket);
      }

      await Promise.all(
        buckets.map(async (bucket: Bucket) => {
          try {
            const bucketWebsite = await this.getBucketWebsiteForBucket(ctx, bucket);
            out.push(bucketWebsite);
          } catch (_) {
            // it'll raise in case there's website
          }
        }),
      );
      return out;
    },
    updateOrReplace: () => 'update',
    update: async (es: BucketWebsite[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        await this.saveBucketWebsite(ctx, e);
        out.push(e);
      }
      return out;
    },
    delete: async (es: BucketWebsite[], ctx: Context) => {
      const out: BucketWebsite[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.bucket.region)) as AWS;
        await client.s3Client.deleteBucketWebsite({
          Bucket: e.bucketName,
        });
        out.push(e);
      }
      return out;
    },
  });

  private async saveBucketWebsite(ctx: Context, e: BucketWebsite) {
    const client = (await ctx.getAwsClient(e.bucket.region)) as AWS;
    await client.s3Client.putBucketWebsite({
      Bucket: e.bucketName,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: e.indexDocument,
        },
        ErrorDocument: {
          Key: e.errorDocument,
        },
      },
    });
  }

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
