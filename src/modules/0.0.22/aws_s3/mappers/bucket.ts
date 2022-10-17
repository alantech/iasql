import {
  S3,
  Bucket as BucketAWS,
  GetBucketPolicyCommandInput,
  PutBucketPolicyCommandInput,
} from '@aws-sdk/client-s3';

import { AwsS3Module } from '..';
import { policiesAreSame } from '../../../../services/aws-diff';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { Bucket } from '../entity';

export class BucketMapper extends MapperBase<Bucket> {
  module: AwsS3Module;
  entity = Bucket;

  async addPolicyToBuckets(client: S3, buckets: BucketAWS[], region: string) {
    const out = [];
    for (const bucket of buckets) {
      // retrieve bucket policy
      const input: GetBucketPolicyCommandInput = {
        Bucket: bucket.Name,
      };

      const bucketPolicy = await this.getBucketPolicy(client, input);
      const b: Bucket = this.module.bucket.bucketMapper(bucket, region);

      if (bucketPolicy && bucketPolicy.Policy) {
        b.policyDocument = JSON.parse(bucketPolicy.Policy);
      } else {
        b.policyDocument = undefined;
      }
      out.push(b);
    }
    return out;
  }

  bucketMapper(instance: BucketAWS, region: string) {
    const b: Bucket = new Bucket();
    if (!instance.Name) throw new Error('Received a bucket without a name');
    b.name = instance.Name;
    b.createdAt = instance.CreationDate;
    b.region = region;
    return b;
  }

  equals = (a: Bucket, b: Bucket) => {
    const res =
      Object.is(a.name, b.name) &&
      Object.is(a.createdAt?.toISOString(), b.createdAt?.toISOString()) &&
      policiesAreSame(a.policyDocument, b.policyDocument) &&
      Object.is(a.region, b.region);
    return res;
  };

  getBuckets = crudBuilderFormat<S3, 'listBuckets', BucketAWS[]>(
    'listBuckets',
    () => ({}),
    res => res?.Buckets ?? [],
  );

  headBucket = crudBuilderFormat<S3, 'headBucket', void>(
    'headBucket',
    name => ({
      Bucket: name,
    }),
    res => res,
  );

  deleteBucket = crudBuilder2<S3, 'deleteBucket'>('deleteBucket', b => ({ Bucket: b }));

  createBucket = crudBuilder2<S3, 'createBucket'>('createBucket', b => ({ Bucket: b }));

  async getBucketPolicy(client: S3, input: GetBucketPolicyCommandInput) {
    try {
      const res = await client.getBucketPolicy(input);
      return res;
    } catch (_) {
      // policy does not exist, return
      return null;
    }
  }
  updateBucketPolicy = crudBuilder2<S3, 'putBucketPolicy'>('putBucketPolicy', input => input);

  async createBucketPolicy(client: S3, bucket: Bucket, ctx: Context) {
    const input: PutBucketPolicyCommandInput = {
      Bucket: bucket.name,
      Policy: JSON.stringify(bucket.policyDocument ?? {}),
    };
    await this.updateBucketPolicy(client, input);
    await this.module.bucket.db.update(bucket, ctx);

    // requery the created policy from AWS
    const inputGet: GetBucketPolicyCommandInput = {
      Bucket: bucket.name,
    };
    const bucketPolicy = await this.getBucketPolicy(client, inputGet);
    if (bucketPolicy && bucketPolicy.Policy) {
      bucket.policyDocument = JSON.parse(bucketPolicy.Policy);
    } else {
      bucket.policyDocument = undefined;
    }
    await this.module.bucket.db.update(bucket, ctx);

    return bucket.policyDocument;
  }

  cloud = new Crud2<Bucket>({
    // TODO: There are lots of useful permission controls on create to be added to this model
    create: async (es: Bucket[], ctx: Context) => {
      const out = [];
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      let client;

      for (const e of es) {
        // if the bucket name exists into another region we cannot create it, throw error
        for (const region of enabledRegions) {
          client = (await ctx.getAwsClient(region)) as AWS;
          try {
            const result = await this.headBucket(client.s3Client, e.name);
            throw new Error('Cannot create bucket, it already exists on another region');
          } catch (error) {
            // we can create the bucket
            client = (await ctx.getAwsClient(e.region)) as AWS;
            await this.createBucket(client.s3Client, e.name);
            out.push(e);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      let out: Bucket[] = [];

      if (!!id) {
        const { region, bucketId } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;

          // list all buckets in region, filtered by id
          const allBuckets = await this.getBuckets(client.s3Client);
          const rawBuckets: BucketAWS[] = allBuckets
            .filter(b => !bucketId || b.Name === bucketId)
            .filter(b => !!b.Name);

          if (rawBuckets && rawBuckets.length > 0) {
            out = await this.addPolicyToBuckets(client.s3Client, rawBuckets, region);
          } else return [];
        }
      } else {
        // we need to retrieve all buckets from all regions
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawBuckets = (await this.getBuckets(client.s3Client)) ?? [];
            out = await this.addPolicyToBuckets(client.s3Client, rawBuckets, region);
          }),
        );
        if (out && out.length > 0) return out;
        else return [];
      }
    },
    updateOrReplace: (a: Bucket, b: Bucket) => {
      if (!Object.is(a.policyDocument, b.policyDocument)) return 'update';
      else return 'replace';
    },
    // TODO: With the model this simple it is actually impossible to really update this thing
    // as the user can't change the create timestamp themselves, so just restore the record from
    // the cloud cache and force it into the DB cache
    update: async (es: Bucket[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.Bucket?.[e.name ?? ''];
        const isUpdate = Object.is(this.module.bucket.cloud.updateOrReplace(cloudRecord, e), 'update');
        if (isUpdate) {
          e.createdAt = cloudRecord.createdAt;
          e.policyDocument = await this.module.bucket.createBucketPolicy(client.s3Client, e, ctx);
          out.push(e);
        } else {
          // if region has changed, we need to delete from older region and create in the new one
          if (cloudRecord.region !== e.region) {
            await this.module.bucket.cloud.delete(e, ctx);
            await this.module.bucket.cloud.create(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            // Replace if name has changed
            await this.module.bucket.db.update(cloudRecord, ctx);
            ctx.memo.db.Bucket[cloudRecord.name] = cloudRecord;
            out.push(cloudRecord);
          }
        }
      }
      return out;
    },
    delete: async (es: Bucket[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
