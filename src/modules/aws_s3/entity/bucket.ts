import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS S3 buckets.
 *
 * @example
 * ```sql
 * INSERT INTO bucket (name) VALUES ('bucket');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L129
 * @see https://aws.amazon.com/s3/
 */
@Entity()
@Unique('uq_bucket_name_region', ['name', 'region'])
export class Bucket {
  /**
   * @private
   * Auto-incremented ID field for the S3 bucket
   */
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })

  /**
   * @public
   * Name to identify the bucket
   */
  @cloudId
  name: string;

  /**
   * @public
   * Complex type representing the policy attached to the bucket
   * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-iam-policies.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  policyDocument?: any;

  /**
   * @public
   * Creation date
   */
  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  createdAt?: Date;

  /**
   * @public
   * Region for the bucket
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
