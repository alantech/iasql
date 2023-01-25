import { S3, waitUntilObjectExists } from '@aws-sdk/client-s3';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsS3Module } from '..';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import { BucketObject } from '../entity';

/**
 * Method to upload an S3 object
 *
 * Returns following columns:
 * - bucket: name of the bucket to host the object
 * - key: identifier key of the object
 * - status: Status of the upload operation. OK if succeeded
 * - response_message: Error message in case of failure
 *
 * Accepts the following parameters:
 * - name: name of the bucket to host the object
 * - key: identifier for the object
 * - content: blob for the object to upload
 * - contentType: MIME type for the uploaded object
 *
 * @example
 * ```sql TheButton[Uploads an object]="Uploads an object"
 * SELECT * FROM s3_upload_object('bucket', 'object_key', '{
 * name: 'Iasql',
 * value: 'Hello world!',
 * }', 'application/json')`,
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L209
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html
 *
 */
export class S3UploadObjectRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsS3Module;

  /**
   * @internal
   */
  outputTable = {
    bucket: 'varchar',
    key: 'varchar',
    status: 'varchar',
    response_message: 'varchar',
  } as const;

  /**
   * @internal
   */
  getBucketLocation = crudBuilderFormat<S3, 'getBucketLocation', string | undefined>(
    'getBucketLocation',
    name => ({
      Bucket: name,
    }),
    res => res?.LocationConstraint,
  );

  /**
   * @internal
   */
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
      throw new Error('Cannot upload an object without bucket name, key, content or content type');
    }

    const client = (await ctx.getAwsClient(await ctx.getDefaultRegion())) as AWS;

    // first determine bucket region
    const region = (await this.getBucketLocation(client.s3Client, bucketName)) ?? 'us-east-1';
    const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];

    if (region) {
      // check if it is on enabled regions
      if (enabledRegions.includes(region)) {
        const clientRegion = (await ctx.getAwsClient(region)) as AWS;

        const result = await clientRegion.s3Client.putObject({
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
