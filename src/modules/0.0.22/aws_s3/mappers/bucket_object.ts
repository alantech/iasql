import { S3, _Object, paginateListObjectsV2, waitUntilObjectNotExists } from '@aws-sdk/client-s3';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { Bucket, BucketObject } from '../entity';

export class BucketObjectMapper extends MapperBase<BucketObject> {
  module: AwsS3Module;
  entity = BucketObject;

  async bucketObjectMapper(instance: _Object, ctx: Context, bucket: String, region: string) {
    const bo: BucketObject = new BucketObject();
    if (!instance.Key) throw new Error('Received a bucket object without a key');

    // check for bucket instance
    if (!Object.values(ctx.memo?.cloud?.Bucket ?? {}).length) {
      bo.bucket =
        (await this.module.bucket.db.read(ctx, `${bucket}|${region}`)) ??
        (await this.module.bucket.cloud.read(ctx, `${bucket}|${region}`));
    } else {
      bo.bucket =
        (await this.module.bucket.db.read(ctx, `${bucket}|${region}`)) ??
        ctx?.memo?.cloud?.BucketAWS?.[`${bucket}|${region}`];
    }

    bo.region = region;
    bo.eTag = instance.ETag;
    bo.key = instance.Key;
    return bo;
  }

  equals = (a: BucketObject, b: BucketObject) => {
    const res = Object.is(a.eTag, b.eTag);
    return res;
  };

  getBucketObjects = paginateBuilder<S3>(paginateListObjectsV2, 'Contents', undefined, undefined, (b, k) => ({
    Bucket: b,
    Prefix: k,
  }));

  deleteBucketObject = crudBuilder2<S3, 'deleteObject'>('deleteObject', (b, k) => ({ Bucket: b, Key: k }));

  cloud = new Crud2<BucketObject>({
    create: async (es: BucketObject[], ctx: Context) => {
      // we cannot create buckets
      const out: any = [];
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];

      if (!!id) {
        const { bucketName, objectKey, region } = this.idFields(id);

        if (enabledRegions.includes(region)) {
          const regionClient = (await ctx.getAwsClient(region)) as AWS;

          const bucketObjects = await this.getBucketObjects(regionClient.s3Client, bucketName, objectKey);
          for (const o of bucketObjects) {
            const finalObject = await this.bucketObjectMapper(o, ctx, bucketName, region);
            return finalObject;
          }
        }
      } else {
        const out: BucketObject[] = [];

        // we need to retrieve all buckets from all regions, then read their objects
        const rawBuckets =
          (await this.module.bucket.db.read(ctx)) ?? (await this.module.bucket.cloud.read(ctx)) ?? [];
        for (const bucket of rawBuckets) {
          // instantiate client with the specific region
          const clientRegion = (await ctx.getAwsClient(bucket.region ?? 'us-east-1')) as AWS;

          // retrieve objects
          try {
            const objects = await this.getBucketObjects(clientRegion.s3Client, bucket.name);
            for (const o of objects) {
              const finalObject = await this.bucketObjectMapper(o, ctx, bucket.name, bucket.region);
              if (finalObject) out.push(finalObject);
            }
          } catch (e) {
            // do nothing, try the next bucket
          }
        }
        return out;
      }
    },
    update: async (es: BucketObject[], ctx: Context) => {
      // we can just replace, no modification allowed
      const out = [];

      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.BucketObject?.[this.entityId(e)];
        await this.module.bucketObject.db.update(cloudRecord, ctx);
        ctx.memo.db.BucketObject[this.entityId(cloudRecord)] = cloudRecord;
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: BucketObject[], ctx: Context) => {
      for (const e of es) {
        if (e.key && e.bucket?.name) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          await this.deleteBucketObject(client.s3Client, e.bucket?.name, e.key);

          // wait until the object is available
          const res = await waitUntilObjectNotExists(
            {
              client: client.s3Client,
              // all in seconds
              maxWaitTime: 900,
              minDelay: 1,
              maxDelay: 4,
            } as WaiterOptions<S3>,
            { Bucket: e.bucket.name, Key: e.key },
          );
        }
      }
    },
  });

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
