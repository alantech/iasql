import { ModuleBase } from '../interfaces';
import { BucketMapper, BucketObjectMapper, BucketWebsiteMapper, PublicAccessBlockMapper } from './mappers';
import { S3UploadObjectRpc } from './rpcs';

export class AwsS3Module extends ModuleBase {
  /** @internal */
  bucket: BucketMapper;

  /** @internal */
  bucketObject: BucketObjectMapper;

  /** @internal */
  s3UploadObject: S3UploadObjectRpc;

  /** @internal */
  publicAccessBlock: PublicAccessBlockMapper;

  /** @internal */
  bucketWebsite: BucketWebsiteMapper;

  constructor() {
    super();
    // Mappers
    this.bucket = new BucketMapper(this);
    this.bucketObject = new BucketObjectMapper(this);
    this.publicAccessBlock = new PublicAccessBlockMapper(this);
    this.bucketWebsite = new BucketWebsiteMapper(this);
    // RPCs
    this.s3UploadObject = new S3UploadObjectRpc(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-s3-integration.ts#S3 Integration Testing#Manage buckets
 * modules/aws-s3-integration.ts#S3 bucket policy integration testing#Manage policies
 * ```
 */
export const awsS3 = new AwsS3Module();
