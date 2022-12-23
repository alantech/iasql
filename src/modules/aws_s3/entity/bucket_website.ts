import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { Bucket } from './bucket';

/**
 * Table to manage AWS S3 website.
 *
 * A bucket website can be used to host a static website (e.g. React app) using just the S3 bucket and no additional servers
 *
 * @example
 * ```sql TheButton[Create a Static Website For Bucket]="Create a Static Website For Bucket"
 * INSERT INTO bucket_website (bucket_name, index_document, error_document) VALUES ('mybucket', 'index.html', 'index.html');
 * ```
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html
 */
@Entity()
export class BucketWebsite {
  /**
   * @public
   * Specify the home or default page of the website.
   */
  @Column({
    nullable: false,
  })
  indexDocument: string;

  /**
   * @public
   * This is returned when an error occurs.
   */
  @Column({
    nullable: true,
  })
  errorDocument?: string;

  /**
   * @public
   * Name of the bucket
   */
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  bucketName: string;

  /**
   * @public
   * Reference for the bucket
   */
  @OneToOne(() => Bucket, bucket => bucket.name, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'bucket_name',
      referencedColumnName: 'name',
    },
  ])
  bucket: Bucket;
}
