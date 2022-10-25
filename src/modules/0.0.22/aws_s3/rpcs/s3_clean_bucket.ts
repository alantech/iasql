import { S3, _Object } from '@aws-sdk/client-s3';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { BucketObject } from '../entity';

export class S3CleanBucketRpc extends RpcBase {
  module: AwsS3Module;
  outputTable = {
    bucket: 'varchar',
    status: 'varchar',
    response_message: 'varchar',
  } as const;

  getBucketObjects = crudBuilderFormat<S3, 'listObjectsV2', _Object[]>(
    'listObjectsV2',
    bucketName => ({ Bucket: bucketName }),
    res => res?.Contents ?? [],
  );
  deleteBucketObject = crudBuilder2<S3, 'deleteObject'>('deleteObject', (bucketName, key) => ({
    Bucket: bucketName,
    Key: key,
  }));
  getBucketLocation = crudBuilderFormat<S3, 'getBucketLocation', string | undefined>(
    'getBucketLocation',
    name => ({
      Bucket: name,
    }),
    res => res?.LocationConstraint,
  );

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    bucketName: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // we need to have bucket name as first element of params
    if (!bucketName) {
      return [
        {
          bucket: 'none',
          status: 'KO',
          response_message: 'Please send the bucket name as first parameter of the query',
        },
      ];
    }
    const client = (await ctx.getAwsClient(await ctx.getDefaultRegion())) as AWS;

    // first determine bucket region
    const region = (await this.getBucketLocation(client.s3Client, bucketName)) ?? 'us-east-1';
    const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];

    if (region) {
      // check if it is on enabled regions
      if (enabledRegions.includes(region)) {
        const clientRegion = (await ctx.getAwsClient(region)) as AWS;

        const objects = await this.getBucketObjects(clientRegion.s3Client, bucketName);
        for (const o of objects) {
          if (!o.Key) continue;

          // delete the object
          await this.deleteBucketObject(clientRegion.s3Client, bucketName, o.Key);

          // query for the bucket
          const bucket =
            (await this.module.bucket.db.read(ctx, `${bucketName}|${region}`)) ??
            (await this.module.bucket.cloud.read(ctx, `${bucketName}|${region}`));

          // delete in the db
          const bo = await this.module.bucketObject.db.read(ctx, `${o.Key}|${bucketName}`);
          if (bo) await this.module.bucketObject.db.delete(bo, ctx);
        }

        // query again to see if all objects have been deleted
        const remainingObjects = await this.getBucketObjects(clientRegion.s3Client, bucketName);
        if (!remainingObjects.length) {
          return [
            {
              bucket: bucketName,
              status: 'OK',
              response_message: 'All bucket objects have been deleted',
            },
          ];
        } else {
          return [
            {
              bucket: bucketName,
              status: 'KO',
              response_message: 'There are remaining objects that could not be deleted',
            },
          ];
        }
      } else {
        return [
          {
            bucket: bucketName,
            status: 'KO',
            response_message: 'Bucket could not be deleted because it is not on supported regions',
          },
        ];
      }
    } else {
      return [
        {
          bucket: bucketName,
          status: 'KO',
          response_message: 'Bucket does not exist',
        },
      ];
    }
  };

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
