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
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codepipeline-integration.ts#L424
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
   * A map of attributes with their corresponding values.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/createtopiccommandinput.html#attributes
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  attributes?:
    | {
        DeliveryPolicy?: string | undefined;
        DisplayName?: string | undefined;
        Policy?: string | undefined;
        TracingConfig?: string | undefined;
        KmsMasterKeyId?: string | undefined;
        FifoTopic?: string | undefined;
        ContentBaseDeduplication?: string | undefined;
      }
    | undefined;

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
   * Region for the Codedeploy deployment group
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
