import { AwsSdkInvoker, ModuleBase } from '../interfaces';
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

  invokeS3: AwsSdkInvoker;

  constructor() {
    super();
    this.bucket = new BucketMapper(this);
    this.bucketObject = new BucketObjectMapper(this);
    this.s3UploadObject = new S3UploadObjectRpc(this);
    this.publicAccessBlock = new PublicAccessBlockMapper(this);
    this.bucketWebsite = new BucketWebsiteMapper(this);
    this.invokeS3 = new AwsSdkInvoker('s3Client', this);
    super.init();
  }
}

export const awsS3 = new AwsS3Module();
