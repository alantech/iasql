import {
  S3,
  Bucket as BucketAWS,
  GetBucketPolicyCommandInput,
  PutBucketPolicyCommandInput,
  ListBucketsCommandInput,
  CreateBucketCommandInput,
  CreateBucketCommandOutput,
} from '@aws-sdk/client-s3';

import { AWS, crudBuilder2, crudBuilderFormat } from '../../../services/aws_macros';
import { Bucket } from './entity';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import * as metadata from './module.json';
import isEqual from 'lodash.isequal';

const getBuckets = crudBuilderFormat<S3, 'listBuckets', BucketAWS[]>(
  'listBuckets',
  () => ({}),
  res => res?.Buckets ?? []
);

const deleteBucket = crudBuilder2<S3, 'deleteBucket'>('deleteBucket', b => ({ Bucket: b }));

const createBucket = crudBuilder2<S3, 'createBucket'>('createBucket', b => ({ Bucket: b }));

async function getBucketPolicy(client: S3, input: GetBucketPolicyCommandInput) {
  try {
    const res = await client.getBucketPolicy(input);
    return res;
  } catch (_) {
    // policy does not exist, return
    return null;
  }
}

const updateBucketPolicy = crudBuilder2<S3, 'putBucketPolicy'>('putBucketPolicy', input => input);

export const AwsS3Module: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      bucketMapper: async (instance: BucketAWS, ctx: Context) => {
        const b: Bucket = new Bucket();
        b.name = instance.Name!;
        b.createdAt = instance.CreationDate;
        return b;
      },
      createBucketPolicy: async (client: S3, bucket: Bucket, ctx: Context) => {
        const input: PutBucketPolicyCommandInput = {
          Bucket: bucket.name,
          Policy: JSON.stringify(bucket.policyDocument ?? {}),
        };
        await updateBucketPolicy(client, input);
        await AwsS3Module.mappers.bucket.db.update(bucket, ctx);

        // requery the created policy from AWS
        const inputGet: GetBucketPolicyCommandInput = {
          Bucket: bucket.name,
        };
        const bucketPolicy = await getBucketPolicy(client, inputGet);
        if (bucketPolicy && bucketPolicy.Policy) {
          bucket.policyDocument = JSON.parse(bucketPolicy.Policy);
        } else {
          bucket.policyDocument = undefined;
        }
        await AwsS3Module.mappers.bucket.db.update(bucket, ctx);

        return bucket.policyDocument;
      },
    },
    mappers: {
      bucket: new Mapper2<Bucket>({
        entity: Bucket,
        equals: (a: Bucket, b: Bucket) => {
          const res =
            Object.is(a.name, b.name) &&
            Object.is(a.createdAt?.toISOString(), b.createdAt?.toISOString()) &&
            isEqual(a.policyDocument, b.policyDocument);
          return res;
        },
        source: 'db',
        cloud: new Crud2({
          // TODO: There are lots of useful permission controls on create to be added to this model
          create: async (es: Bucket[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              await createBucket(client.s3Client, e.name);
              out.push(e);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;

            const allBuckets = await getBuckets(client.s3Client);
            const out: Bucket[] = [];
            const buckets: BucketAWS[] = allBuckets.filter(b => !id || b.Name === id).filter(b => !!b.Name);

            for (const index in buckets) {
              if (buckets.hasOwnProperty(index)) {
                const bucket = buckets[index];

                // retrieve bucket policy
                const input: GetBucketPolicyCommandInput = {
                  Bucket: bucket.Name,
                };
                const bucketPolicy = await getBucketPolicy(client.s3Client, input);
                const b: Bucket = await AwsS3Module.utils.bucketMapper(bucket);

                if (bucketPolicy && bucketPolicy.Policy) {
                  b.policyDocument = JSON.parse(bucketPolicy.Policy);
                } else {
                  b.policyDocument = undefined;
                }
                out.push(b);
              }
            }
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
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.Bucket?.[e.name ?? ''];
              const isUpdate = Object.is(AwsS3Module.mappers.bucket.cloud.updateOrReplace(cloudRecord, e), 'update');
              if (isUpdate) {
                e.createdAt = cloudRecord.createdAt;
                e.policyDocument = await AwsS3Module.utils.createBucketPolicy(client.s3Client, e, ctx);
                out.push(e);
              } else {
                // Replace if name has changed
                await AwsS3Module.mappers.bucket.db.update(cloudRecord, ctx);
                ctx.memo.db.Bucket[cloudRecord.name] = cloudRecord;
                out.push(cloudRecord);
              }
            }
            return out;
          },
          delete: async (es: Bucket[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteBucket(client.s3Client, e.name);
            }
          },
        }),
      }),
    },
  },
  __dirname
);
