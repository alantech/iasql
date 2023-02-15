import { Max, Min } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
export class Queue {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Amazon SQS assigns a unique identifier called a queue URL to each new queue.
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  @cloudId
  url?: string;

  /**
   * @public
   * Name for the SQS queue
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html#queuename
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  name: string;

  /**
   * @public
   * Designates a queue as FIFO. If not specified, the queue will be created in standard mode.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Column({
    default: false,
    type: 'boolean',
  })
  fifoQueue: boolean;

  /**
   * @public
   * The visibility timeout for the queue, in seconds. Valid values: An integer from 0 to 43,200 (12 hours).
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Min(0)
  @Max(43_200)
  @Column({
    default: 30,
    type: 'integer',
  })
  visibilityTimeout: number;

  /**
   * @public
   * The length of time, in seconds, for which the delivery of all messages in the queue is delayed.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Min(0)
  @Max(900)
  @Column({
    default: 0,
    type: 'integer',
  })
  delaySeconds: number;

  /**
   * @public
   * The length of time, in seconds, for which a ReceiveMessage action waits for a message to arrive.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Min(0)
  @Max(20)
  @Column({
    default: 0,
    type: 'integer',
  })
  receiveMessageWaitTimeSeconds: number;

  /**
   * @public
   * The length of time, in seconds, for which Amazon SQS retains a message.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Min(60)
  @Max(1_209_600)
  @Column({
    default: 345_600,
    type: 'integer',
  })
  messageRetentionPeriod: number;

  /**
   * @public
   * The limit of how many bytes a message can contain before Amazon SQS rejects it.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
   */
  @Min(1_024)
  @Max(262_144)
  @Column({
    default: 262_144, // 256 KiB
    type: 'integer',
  })
  maximumMessageSize: number;

  /**
   * @public
   * The queue's policy. A valid Amazon Web Services policy.
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/PoliciesOverview.html
   */
  @Column({
    type: 'json',
    nullable: false,
  })
  policy: object;

  /**
   * @public
   * The queue ARN.
   */
  @Column({
    nullable: true,
    unique: true,
    type: 'varchar',
  })
  arn?: string;

  /**
   * @public
   * Region for the SQS queue
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
