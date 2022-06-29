import { S3, } from '@aws-sdk/client-s3'

import { AWS, crudBuilder2, } from '../../../services/aws_macros'
import { Bucket, } from './entity'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'

const createBucket = crudBuilder2<S3, 'createBucket'>(
  'createBucket',
  (b) => ({ Bucket: b, }),
);
const getBuckets = crudBuilder2<S3, 'listBuckets'>(
  'listBuckets',
  () => ({}),
  (res) => res?.Buckets ?? [],
);
const deleteBucket = crudBuilder2<S3, 'deleteBucket'>(
  'deleteBucket',
  (b) => ({ Bucket: b, }),
);

export const AwsS3Module: Module2 = new Module2({
  ...metadata,
  mappers: {
    bucket: new Mapper2<Bucket>({
      entity: Bucket,
      equals: (a: Bucket, b: Bucket) => Object.is(a.name, b.name) &&
        Object.is(a.createdAt?.toISOString(), b.createdAt?.toISOString()),
      source: 'db',
      cloud: new Crud2({
        // TODO: There are lots of useful permission controls on create to be added to this model
        create: async (es: Bucket[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await createBucket(client.s3Client, e.name);
          }
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          const allBuckets = await getBuckets(client.s3Client);
          return allBuckets
            .filter((b: any) => !id || b.Name === id)
            .filter((b: any) => !!b.Name)
            .map((b: any) => {
              const bucket = new Bucket();
              bucket.name = b.Name ?? ''; // The filter above is guarding this but TS is confused
              bucket.createdAt = b.CreationDate;
              return bucket;
            });
        },
        // TODO: With the model this simple it is actually impossible to really update this thing
        // as the user can't change the create timestamp themselves, so just restore the record from
        // the cloud cache and force it into the DB cache
        update: async (es: Bucket[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Bucket?.[e.name ?? ''];
            await AwsS3Module.mappers.bucket.db.update(cloudRecord, ctx);
            ctx.memo.db.Bucket[cloudRecord.name] = cloudRecord;
            out.push(cloudRecord);
          }
          return out;
        },
        delete: async (es: Bucket[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await deleteBucket(client.s3Client, e.name);
          }
        },
      }),
    }),
  },
}, __dirname)
