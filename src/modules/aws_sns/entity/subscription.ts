import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Topic } from './topic';

/**
 * Table to manage AWS SNS subscriptions. Amazon Simple Notification Service (Amazon SNS) is a managed
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
export class Subscription {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * SNS topic to subscribe
   */
  @ManyToOne(() => Topic, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'topic',
      referencedColumnName: 'arn',
    },
  ])
  @cloudId
  topic: Topic;

  /**
   * @public
   * The endpoint that you want to receive notifications. Endpoints vary by protocol
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#endpoint
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  endpoint?: string;

  /**
   * @public
   * Region for the SNS subscription
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

  /**
   * @public
   * The protocol that you want to use
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#protocol
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  protocol?: string;

  /**
   * @public
   * The subscription's ARN.
   */
  @Column({
    nullable: true,
    unique: true,
  })
  arn?: string;
}
