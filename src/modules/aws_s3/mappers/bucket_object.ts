import { S3, _Object, paginateListObjectsV2, waitUntilObjectNotExists } from '@aws-sdk/client-s3';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { BucketObject } from '../entity';

export class BucketObjectMapper extends MapperBase<BucketObject> {
  module: AwsS3Module;
  entity = BucketObject;

  async bucketObjectMapper(instance: _Object, ctx: Context, bucket: String, region: string) {
    const bo: BucketObject = new BucketObject();
    if (!instance.Key) throw new Error('Received a bucket object without a key');

    // check for bucket instance
    const bucketInstance =
      (await this.module.bucket.db.read(ctx, `${bucket}|${region}`)) ??
      (await this.module.bucket.cloud.read(ctx, `${bucket}|${region}`));

    if (bucketInstance) {
      bo.bucketName = bucketInstance.name;
      bo.bucket = bucketInstance;
      bo.region = region;
      bo.eTag = instance.ETag;
      bo.key = instance.Key;
    }
    return bo;
  }

  equals = (a: BucketObject, b: BucketObject) => {
    const res = Object.is(a.eTag, b.eTag);
    return res;
  };

  getBucketObjects = paginateBuilder<S3>(paginateListObjectsV2, 'Contents', undefined, undefined, (b, k) => {
    const out: any = { Bucket: b };
    if (k) out.Prefix = k;
    return out;
  });

  deleteBucketObject = crudBuilder2<S3, 'deleteObject'>('deleteObject', (b, k) => ({ Bucket: b, Key: k }));

  cloud = new Crud2<BucketObject>({
    create: async (es: BucketObject[], ctx: Context) => {
      // we cannot create buckets, remove the existing ones
      await this.module.bucketObject.db.delete(es, ctx);

      const out: any = [];
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];

      if (!!id) {
        const { bucketName, key, region } = this.idFields(id);

        if (enabledRegions.includes(region)) {
          const regionClient = (await ctx.getAwsClient(region)) as AWS;

          const bucketObjects = await this.getBucketObjects(regionClient.s3Client, bucketName, key);
          for (const o of bucketObjects) {
            const finalObject = await this.bucketObjectMapper(o, ctx, bucketName, region);
            return finalObject;
          }
        }
      } else {
        const out: BucketObject[] = [];

        // we need to retrieve all buckets from all regions, then read their objects
        // CANNOT use the db listing in case the bucket itself was deleted by the user
        const rawBuckets = (await this.module.bucket.cloud.read(ctx)) ?? [];
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
      // we can just restore, no modification allowed
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
        if (e.key && e.bucketName) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          await this.deleteBucketObject(client.s3Client, e.bucketName, e.key);

          // wait until the object is no longer available
          await waitUntilObjectNotExists(
            {
              client: client.s3Client,
              // all in seconds
              maxWaitTime: 900,
              minDelay: 1,
              maxDelay: 30,
            } as WaiterOptions<S3>,
            { Bucket: e.bucketName, Key: e.key },
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
