import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Bucket } from './bucket';

/**
 * Table to manage the objects associated to an S3 bucket. To store your data in Amazon S3, you work with resources known as buckets and objects.
 * A bucket is a container for objects. An object is a file and any metadata that describes that file.
 *
 * Objects can only be listed and deleted, will need to be uploaded using an specific RPC method
 *
 * @example
 * ```sql TheButton[Manage Bucket Objects]="Manage Bucket Objects"
 * SELECT * FROM bucket_object WHERE bucket_name = 'bucket' AND key='object_key';
 * DELETE FROM bucket_object WHERE bucket_name = 'bucket' AND key='object_key';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L253
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingObjects.html
 */
@Entity()
@Unique('uq_bucketobject_bucket_name_key_region', ['bucketName', 'key', 'region'])
export class BucketObject {
  /**
   * @private
   * Auto-incremented ID field for EC2 instance
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Key to identify this specific object
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  key: string;

  /**
   * @public
   * Name of the bucket containing this object
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  bucketName: string;

  /**
   * @public
   * Reference for the bucket containing this object
   */
  @ManyToOne(() => Bucket, bucket => bucket.name, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'bucket_name',
      referencedColumnName: 'name',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  bucket?: Bucket;

  /**
   * @public
   * Region for the S3 object
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;

  /**
   * @public
   * Hash for the object
   * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_Object.html
   */
  @Column({
    type: 'varchar',
    nullable: true,
  })
  eTag?: string;
}
