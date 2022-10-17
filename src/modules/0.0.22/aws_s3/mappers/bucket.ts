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
            await this.headBucket(client.s3Client, e.name);
            throw new Error('Cannot create the bucket, it already exists in another region');
          } catch (_) {}
        }

        // we can create the bucket
        client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.createBucket(client.s3Client, e.name);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      console.log('in read');
      const client = (await ctx.getAwsClient(await ctx.getDefaultRegion())) as AWS;
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      let out: Bucket[] = [];
      let rawBuckets: BucketAWS[] = [];
      console.log('is is');
      console.log(id);

      if (!!id) {
        const { region, bucketId } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const allBuckets = await this.getBuckets(client.s3Client);
          rawBuckets = allBuckets.filter(b => !bucketId || b.Name === bucketId).filter(b => !!b.Name);
        }
      } else {
        // we need to retrieve all buckets from all regions
        rawBuckets = (await this.getBuckets(client.s3Client)) ?? [];
      }
      console.log('raw is');
      console.log(rawBuckets);

      if (rawBuckets && rawBuckets.length > 0) {
        for (const rawBucket of rawBuckets) {
          // for each bucket, retrieve the location
          let location = await this.getBucketLocation(client.s3Client, rawBucket.Name);
          console.log('locatio is');
          console.log(location);
          if (!location) location = 'us-east-1';
          if (enabledRegions.includes(location)) {
            console.log('i map');
            // read policy
            const input: GetBucketPolicyCommandInput = {
              Bucket: rawBucket.Name,
            };

            const bucketPolicy = await this.getBucketPolicy(client.s3Client, input);
            const b: Bucket = this.module.bucket.bucketMapper(rawBucket, location);

            if (bucketPolicy && bucketPolicy.Policy) {
              b.policyDocument = JSON.parse(bucketPolicy.Policy);
            } else {
              b.policyDocument = undefined;
            }
            console.log(', have');
            console.log(b);
            out.push(b);
          }
        }
      }
      console.log('after all read');
      console.log(out);
      return out;
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
