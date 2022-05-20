import { AWS, } from '../../../services/gateways/aws'
import { Bucket, } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsS3Module: Module = new Module({
  ...metadata,
  mappers: {
    bucket: new Mapper<Bucket>({
      entity: Bucket,
      equals: (a: Bucket, b: Bucket) => Object.is(a.name, b.name) &&
        Object.is(a.createdAt?.toISOString(), b.createdAt?.toISOString()),
      source: 'db',
      cloud: new Crud({
        // TODO: There are lots of useful permission controls on create to be added to this model
        create: async (es: Bucket[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.createBucket(e.name);
          }
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const allBuckets = await client.getBuckets();
          return allBuckets
            .filter(b => !ids || ids.length === 0 || ids.includes(b.Name ?? ''))
            .map(b => {
              const bucket = new Bucket;
              bucket.name = b.Name ?? '';
              bucket.createdAt = b.CreationDate;
              return bucket;
            });
        },
        // TODO: With the model this simple it is actually impossible to really update this thing
        // as the user can't change the create timestamp themselves, so just restore the record from
        // the cloud cache and force it into the DB cache
        update: async (es: Bucket[], ctx: Context) => {
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Bucket?.[e.name ?? ''];
            await AwsS3Module.mappers.bucket.db.update(cloudRecord, ctx);
            ctx.memo.db.Bucket[cloudRecord.name] = cloudRecord;
          }
        },
        delete: async (es: Bucket[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteBucket(e.name);
          }
        },
      }),
    }),
  },
}, __dirname)
