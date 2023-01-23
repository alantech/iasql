import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS SNS topics. Amazon Simple Notification Service (Amazon SNS) is a managed
 * service that provides message delivery from publishers to subscribers (also known as producers and consumers).
 * Publishers communicate asynchronously with subscribers by sending messages to a topic,
 * which is a logical access point and communication channel.
 *
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-sns-integration.ts#L120
 * @see https://docs.aws.amazon.com/sns/latest/dg/welcome.html
 *
 */
@Entity()
@Unique('uq_topic_name_region', ['name', 'region'])
export class Topic {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the SNS topic
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/createtopiccommandinput.html#name
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  name: string;

  /**
   * @public
   * The policy that defines how Amazon SNS retries failed deliveries to HTTP/S endpoints.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  deliveryPolicy?: string | undefined;

  /**
   * @public
   * The display name to use for a topic with SMS subscriptions.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  displayName?: string | undefined;

  /**
   * @public
   * The policy that defines who can access your topic. By default, only the topic owner can publish or subscribe to the topic.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  policy?: string | undefined;

  /**
   * @public
   * Tracing mode of an Amazon SNS topic.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  tracingConfig?: string | undefined;

  /**
   * @public
   * The ID of an Amazon Web Services managed customer master key (CMK) for Amazon SNS or a custom CMK.
   * Applies only to server-side encryption
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  kmsMasterKeyId?: string | undefined;

  /**
   * @public
   * The signature version corresponds to the hashing algorithm used.
   * Applies only to server-side encryption
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  signatureVersion?: string | undefined;

  /**
   * @public
   * Enables content-based deduplication for FIFO topics.
   * Applies only to FIFO topics
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    nullable: true,
    type: 'varchar',
  })
  contentBasedDeduplication?: string | undefined;

  /**
   * @public
   * Set to true to create a FIFO topic
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
   */
  @Column({
    type: 'boolean',
    default: false,
  })
  fifoTopic: boolean;

  /**
   * @public
   * The body of the policy document you want to use for this topic.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/createtopicinput.html#dataprotectionpolicy
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  dataProtectionPolicy?: string | undefined;

  /**
   * @public
   * The topic's ARN.
   */
  @Column({
    nullable: true,
    unique: true,
  })
  @cloudId
  arn?: string;

  /**
   * @public
   * Region for the SNS topic
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
