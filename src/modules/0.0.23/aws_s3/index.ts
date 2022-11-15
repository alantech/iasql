import { ModuleBase } from '../../interfaces';
import { BucketMapper, BucketObjectMapper } from './mappers';
import { S3UploadObjectRpc } from './rpcs';

export class AwsS3Module extends ModuleBase {
  bucket: BucketMapper;
  bucketObject: BucketObjectMapper;
  s3UploadObject: S3UploadObjectRpc;

  constructor() {
    super();
    this.bucket = new BucketMapper(this);
    this.bucketObject = new BucketObjectMapper(this);
    this.s3UploadObject = new S3UploadObjectRpc(this);
    super.init();
  }
}
export const awsS3 = new AwsS3Module();
