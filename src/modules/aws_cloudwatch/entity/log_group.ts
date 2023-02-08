import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to query for all AWS Cloudwatch log groups in the system. You can use Amazon CloudWatch Logs to monitor,
 * store, and access your log files from Amazon Elastic Compute Cloud (Amazon EC2) instances,
 * AWS CloudTrail, Route 53, and other sources.
 *
 * A log group is a group of log streams that share the same retention, monitoring, and access control settings.
 * You can define log groups and specify which streams to put into each group.
 * There is no limit on the number of log streams that can belong to one log group.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html
 *
 */
@Entity()
@Index(['logGroupName', 'region'], { unique: true })
export class LogGroup {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Log group name
   */
  @cloudId
  @Column()
  logGroupName: string;

  /**
   * @public
   * AWS ARN for the log group
   */
  @Column({
    nullable: true,
  })
  logGroupArn?: string;

  /**
   * @public
   * Creation time
   */
  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  creationTime?: Date;

  /**
   * @public
   * Region for the log group
   */
  @cloudId
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
