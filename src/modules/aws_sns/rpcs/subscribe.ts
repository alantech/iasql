import { SNS, SubscribeCommandInput } from '@aws-sdk/client-sns';

import { AwsSnsModule } from '..';
import { AWS } from '../../aws_lambda/aws';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method to subscribe to an SNS topic
 *
 * Returns following columns:
 * - arn: The ARN of the subscription that has been confirmed
 * - status: status of the trigger call. OK if succeeded
 * - error: Error message in case of failure
 *
 * Accepts the following parameters:
 * - arn: The ARN of the topic you want to subscribe to.
 * - endpoint: The endpoint that you want to receive notifications. Endpoints vary by protocol
 * - protocol: The protocol that you want to use.
 * - attributes: A map of attributes with their corresponding values
 * - region: Region where the subscription is stored
 *
 * Depending on the subscription endpoint, it will need to be confirmed with the `ConfirmSubscription` RPC call.
 *
 * @example
 * ```sql TheButton[Subscribe to an SNS topic]="Subscribe to an SNS topic"
 * SELECT * FROM subscribe('(SELECT arn FROM topic WHERE name='topic_name')', 'my@email.com', 'email', '{"RawMessageDelivery": "true"}');
 * ```
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#protocol
 * @see https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
 * @see https://iasql.com/docs/reference/classes/aws_sns_rpcs_confirm_subscription.ConfirmSubscriptionRpc/
 *
 */

export class SubscribeRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsSnsModule;

  /**
   * @internal
   */
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    error: 'varchar',
  } as const;

  /**
   * Subscribes to an specific topic
   */
  async subscribe(client: SNS, input: SubscribeCommandInput) {
    return await client.subscribe(input);
  }

  /**
   * @internal
   */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    arn: string,
    endpoint: string,
    protocol: string,
    attributes: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!arn || !endpoint || !protocol) {
      throw new Error(
        'Please provide a valid SNS topic ARN, endpoint and protocol to perform the subscription.',
      );
    }
    const clientRegion = region ?? (await ctx.getDefaultRegion());
    const client = (await ctx.getAwsClient(clientRegion)) as AWS;

    let attr;
    try {
      if (attributes) attr = JSON.parse(attributes) as Record<string, string>;
    } catch (e) {
      throw new Error('Plesae provide valid attributes for the subscription.');
    }

    const input: SubscribeCommandInput = {
      Attributes: attr,
      Endpoint: endpoint,
      Protocol: protocol,
      ReturnSubscriptionArn: true,
      TopicArn: arn,
    };

    try {
      const res = await this.subscribe(client.snsClient, input);
      if (res && res.SubscriptionArn) {
        // ok, we have subscribed
        return [
          {
            arn: res.SubscriptionArn,
            status: 'OK',
            error: '',
          },
        ];
      } else {
        return [
          {
            arn: '',
            status: 'KO',
            error: 'Error performing subscription',
          },
        ];
      }
    } catch (e) {
      return [
        {
          arn: '',
          status: 'KO',
          error: e,
        },
      ];
    }
  };

  constructor(module: AwsSnsModule) {
    super();
    this.module = module;
    super.init();
  }
}
