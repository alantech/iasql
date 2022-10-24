import { S3, _Object, paginateListObjectsV2 } from '@aws-sdk/client-s3';

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
        ctx?.memo?.cloud?.CodebuildProject?.[`${bucket}|${region}`];
    }
    bo.region = region;
    bo.eTag = instance.ETag;
    bo.key = instance.Key;
    bo.lastModified = instance.LastModified;
    bo.size = instance.Size;
    return bo;
  }

  equals = (a: BucketObject, b: BucketObject) => {
    const res =
      Object.is(a.eTag, b.eTag) && Object.is(a.lastModified, b.lastModified) && Object.is(a.size, b.size);
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
      const client = (await ctx.getAwsClient(await ctx.getDefaultRegion())) as AWS;
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      const out: Bucket[] = [];
      let rawObjects: BucketObject[] = [];

      if (!!id) {
        const { bucketName, objectKey, region } = this.idFields(id);

        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;

          const bucketObjects = await this.getBucketObjects(client.s3Client, bucketName, objectKey);
          for (const o of bucketObjects) {
            const finalObject = await this.bucketObjectMapper(o, ctx, bucketName, region);
            return finalObject;
          }
        }
      } else {
        // we need to retrieve all buckets from all regions, then read their objects
        const rawBuckets = (await this.module.bucket.db.read(client.s3Client)) ?? [];
        const out = [];
        for (const bucket of rawBuckets) {
          // retrieve objects
          const objects = await this.getBucketObjects(client.s3Client, bucket.name);
          for (const o of objects) {
            const finalObject = await this.bucketObjectMapper(o, ctx, bucket.name, bucket.region);
            if (finalObject) out.push(finalObject);
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
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteBucketObject(client.s3Client, e.bucket, e.key);
      }
    },
  });

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
