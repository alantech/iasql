import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to query for all AWS Cloudwatch log groups in the system.
 *
 * @example
 * ```sql
 * INSERT INTO log_group (log_group_name) VALUES ('log_name');
 * SELECT * FROM log_group WHERE log_group_name = 'log_name';
 * DELETE FROM log_group WHERE log_group_name = 'log_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-cloudwatch-integration.ts#L309
 * @see https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html
 *
 */
@Entity()
@Index(['logGroupName', 'region'], { unique: true })
export class LogGroup {
  /**
   * @private
   * Auto-incremented ID field for storing log groups
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
