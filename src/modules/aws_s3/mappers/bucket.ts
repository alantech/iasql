import {
  Bucket as BucketAWS,
  GetBucketPolicyCommandInput,
  PutBucketPolicyCommandInput,
  S3,
} from '@aws-sdk/client-s3';

import { AwsS3Module } from '..';
import { policiesAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder, crudBuilderFormat, eqTags } from '../../../services/aws_macros';
import { convertTagsForAws, convertTagsFromAws } from '../../aws_vpc/mappers/tags';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Bucket } from '../entity';

export class BucketMapper extends MapperBase<Bucket> {
  module: AwsS3Module;
  entity = Bucket;

  bucketMapper(instance: BucketAWS, region: string) {
    const b: Bucket = new Bucket();
    if (!instance.Name) throw new Error('Received a bucket without a name');
    b.name = instance.Name;
    b.createdAt = instance.CreationDate;
    b.region = region;
    return b;
  }

  equals = (a: Bucket, b: Bucket) =>
    Object.is(a.createdAt?.toISOString(), b.createdAt?.toISOString()) && policiesAreSame(a.policy, b.policy);

  getBuckets = crudBuilderFormat<S3, 'listBuckets', BucketAWS[]>(
    'listBuckets',
    () => ({}),
    res => res?.Buckets ?? [],
  );

  getBucketLocation = crudBuilderFormat<S3, 'getBucketLocation', string | undefined>(
    'getBucketLocation',
    name => ({
      Bucket: name,
    }),
    res => res?.LocationConstraint,
  );

  headBucket = crudBuilderFormat<S3, 'headBucket', void>(
    'headBucket',
    name => ({
      Bucket: name,
    }),
    res => res,
  );

  deleteBucket = crudBuilder<S3, 'deleteBucket'>('deleteBucket', b => ({ Bucket: b }));

  createBucket = crudBuilder<S3, 'createBucket'>('createBucket', b => ({ Bucket: b }));

  async getBucketPolicy(client: S3, input: GetBucketPolicyCommandInput) {
    try {
      const res = await client.getBucketPolicy(input);
      return res;
    } catch (_) {
      // policy does not exist, return
      return null;
    }
  }

  updateBucketPolicy = crudBuilder<S3, 'putBucketPolicy'>('putBucketPolicy', input => input);

  async setBucketTags(client: S3, bucket: Bucket) {
    await client.putBucketTagging({
      Bucket: bucket.name,
      Tagging: {
        TagSet: convertTagsForAws(bucket.tags ?? {}),
      },
    });
  }

  async createBucketPolicy(client: S3, bucket: Bucket, ctx: Context) {
    const input: PutBucketPolicyCommandInput = {
      Bucket: bucket.name,
      Policy: JSON.stringify(bucket.policy ?? {}),
    };
    await this.updateBucketPolicy(client, input);

    // requery the created policy from AWS
    const inputGet: GetBucketPolicyCommandInput = {
      Bucket: bucket.name,
    };
    const bucketPolicy = await this.getBucketPolicy(client, inputGet);
    if (bucketPolicy && bucketPolicy.Policy) {
      bucket.policy = JSON.parse(bucketPolicy.Policy);
    } else {
      bucket.policy = undefined;
    }
    await this.module.bucket.db.update(bucket, ctx);

    return bucket.policy;
  }

  cloud = new Crud<Bucket>({
    // TODO: There are lots of useful permission controls on create to be added to this model
    create: async (es: Bucket[], ctx: Context) => {
      const out = [];
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      let client;

      for (const e of es) {
        // if the bucket name exists in another region we cannot create it, throw error
        for (const region of enabledRegions) {
          client = (await ctx.getAwsClient(region)) as AWS;
          try {
            await this.headBucket(client.s3Client, e.name);
            throw new Error('Cannot create the bucket, it already exists in another region');
          } catch (_) {
            // it is ok, we can create bucket
          }
        }

        // we can create the bucket
        client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.createBucket(client.s3Client, e.name);

        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient(await ctx.getDefaultRegion())) as AWS;
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      const out: Bucket[] = [];
      let rawBuckets: BucketAWS[] = [];

      if (!!id) {
        const { name, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const allBuckets = await this.getBuckets(client.s3Client);
          const foundBucket = allBuckets.find((b: BucketAWS) => b.Name === name);
          if (foundBucket) {
            // read policy
            const input: GetBucketPolicyCommandInput = {
              Bucket: foundBucket.Name,
            };

            const bucketPolicy = await this.getBucketPolicy(client.s3Client, input);
            const b: Bucket = this.bucketMapper(foundBucket, region);

            if (bucketPolicy && bucketPolicy.Policy) {
              b.policy = JSON.parse(bucketPolicy.Policy);
            } else {
              b.policy = undefined;
            }
            const tags = await client.s3Client.getBucketTagging({ Bucket: foundBucket.Name });
            b.tags = convertTagsFromAws(tags.TagSet);
            return b;
          }
        }
      } else {
        // we need to retrieve all buckets from all regions
        rawBuckets = (await this.getBuckets(client.s3Client)) ?? [];
      }

      if (rawBuckets && rawBuckets.length > 0) {
        for (const rawBucket of rawBuckets) {
          // for each bucket, retrieve the location
          let location;
          try {
            location = await this.getBucketLocation(client.s3Client, rawBucket.Name);
          } catch (_) {
            // The bucket may have been deleted in the meantime
          }
          if (!location) location = 'us-east-1';
          if (enabledRegions.includes(location)) {
            // read policy
            const input: GetBucketPolicyCommandInput = {
              Bucket: rawBucket.Name,
            };

            const bucketPolicy = await this.getBucketPolicy(
              (
                await ctx.getAwsClient(location)
              ).s3Client as S3,
              input,
            );
            const b: Bucket = this.bucketMapper(rawBucket, location);

            if (bucketPolicy && bucketPolicy.Policy) {
              b.policy = JSON.parse(bucketPolicy.Policy);
            } else {
              b.policy = undefined;
            }
            const tags = await client.s3Client.getBucketTagging({ Bucket: rawBucket.Name });
            b.tags = convertTagsFromAws(tags.TagSet);
            out.push(b);
          }
        }
      }
      return out;
    },
    updateOrReplace: (a: Bucket, b: Bucket) => {
      if (!policiesAreSame(a.policy, b.policy) || !eqTags(a.tags, b.tags)) return 'update';
      else return 'replace';
    },
    // TODO: With the model this simple it is actually impossible to really update this thing
    // as the user can't change the create timestamp themselves, so just restore the record from
    // the cloud cache and force it into the DB cache
    update: async (es: Bucket[], ctx: Context) => {
      const out = [];
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];

      for (const e of es) {
        if (enabledRegions.includes(e.region)) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          const cloudRecord = ctx?.memo?.cloud?.Bucket?.[this.entityId(e)];
          const isUpdate = Object.is(this.module.bucket.cloud.updateOrReplace(cloudRecord, e), 'update');
          if (isUpdate) {
            e.createdAt = cloudRecord.createdAt;
            e.policy = await this.module.bucket.createBucketPolicy(client.s3Client, e, ctx);
            await this.setBucketTags(client.s3Client, e);
            out.push(e);
          } else {
            // we cannot modify bucket name or region of the bucket, replace it
            await this.module.bucket.db.update(cloudRecord, ctx);
            ctx.memo.db.Bucket[this.entityId(cloudRecord)] = cloudRecord;
            out.push(cloudRecord);
          }
        }
      }
      return out;
    },
    delete: async (es: Bucket[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const remainingObjects = await this.module.bucketObject.getBucketObjects(client.s3Client, e.name);
        if (remainingObjects.length > 0)
          throw new Error(`Waiting for deletion of ${remainingObjects.map(o => o.Key).join(', ')}`);
        await this.deleteBucket(client.s3Client, e.name);
      }
    },
  });

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
