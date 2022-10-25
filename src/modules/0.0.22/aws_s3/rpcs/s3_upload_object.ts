import { S3, waitUntilObjectExists, _Object } from '@aws-sdk/client-s3';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { BucketObject } from '../entity';

function isValidHttpUrl(path: string) {
  let url;

  try {
    url = new URL(path);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export class S3UploadObjectRpc extends RpcBase {
  module: AwsS3Module;
  outputTable = {
    bucket: 'varchar',
    key: 'varchar',
    status: 'varchar',
    response_message: 'varchar',
  } as const;

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
    bucketKey: string,
    content: string,
    contentType: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // we need to have bucket name, key and source
    if (!bucketName || !bucketKey || !content || !contentType) {
      return [
        {
          bucket: 'none',
          key: 'none',
          status: 'KO',
          response_message:
            'Please specify bucket name, key, content and content type of the object to upload',
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

        const result = await client.s3Client.putObject({
          Bucket: bucketName,
          Key: bucketKey,
          Body: content,
          ContentType: contentType,
        });

        // wait until the object is available
        const res = await waitUntilObjectExists(
          {
            client: clientRegion.s3Client,
            // all in seconds
            maxWaitTime: 900,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<S3>,
          { Bucket: bucketName, Key: bucketKey },
        );

        if (res.state === 'SUCCESS') {
          // query for the bucket
          const bucket =
            (await this.module.bucket.db.read(ctx, `${bucketName}|${region}`)) ??
            (await this.module.bucket.cloud.read(ctx, `${bucketName}|${region}`));

          // need to insert records in the db
          const bucketObject: BucketObject = {
            key: bucketKey,
            bucketName,
            region,
            bucket,
            eTag: result.ETag,
          };
          await this.module.bucketObject.db.create(bucketObject, ctx);
          // that was ok
          return [
            {
              bucket: bucketName,
              key: bucketKey,
              status: 'OK',
              response_message: 'Bucket content has been updated',
            },
          ];
        } else {
          return [
            {
              bucket: bucketName,
              key: bucketKey,
              status: 'OK',
              response_message: 'There was a problem creating your object',
            },
          ];
        }
      } else {
        return [
          {
            bucket: bucketName,
            key: bucketKey,
            status: 'KO',
            response_message: 'Bucket content could not be updated because it is not on supported regions',
          },
        ];
      }
    }
    return [
      {
        bucket: 'none',
        key: 'none',
        status: 'KO',
        response_message: 'There was an unexpected error uploading your object to bucket',
      },
    ];
  };

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}
