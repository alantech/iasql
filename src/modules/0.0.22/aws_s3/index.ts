import { ModuleBase } from '../../interfaces';
import { BucketMapper } from './mappers';
import { S3CleanBucketRpc } from './rpcs';

export class AwsS3Module extends ModuleBase {
  bucket: BucketMapper;
  s3CleanBucket: S3CleanBucketRpc;

  constructor() {
    super();
    this.bucket = new BucketMapper(this);
    this.s3CleanBucket = new S3CleanBucketRpc(this);
    super.init();
  }
}
export const awsS3 = new AwsS3Module();
