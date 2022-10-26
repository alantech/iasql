import { ModuleBase } from '../../interfaces';
import { BucketMapper, BucketObjectMapper } from './mappers';
import { S3CleanBucketRpc, S3UploadObjectRpc } from './rpcs';

export class AwsS3Module extends ModuleBase {
  bucket: BucketMapper;
  bucketObject: BucketObjectMapper;
  s3CleanBucket: S3CleanBucketRpc;
  s3UploadObject: S3UploadObjectRpc;

  constructor() {
    super();
    this.bucket = new BucketMapper(this);
    this.bucketObject = new BucketObjectMapper(this);
    this.s3CleanBucket = new S3CleanBucketRpc(this);
    this.s3UploadObject = new S3UploadObjectRpc(this);
    super.init();
  }
}
export const awsS3 = new AwsS3Module();
