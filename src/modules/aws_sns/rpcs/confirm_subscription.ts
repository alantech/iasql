import {
  ConfirmSubscriptionCommand,
  ConfirmSubscriptionCommandInput,
  ConfirmSubscriptionInput,
  SNS,
} from '@aws-sdk/client-sns';

import { AwsSnsModule } from '..';
import { AWS } from '../../aws_lambda/aws';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method to confirm an SNS subscription
 *
 * Returns following columns:
 * - arn: The ARN of the subscription that has been confirmed
 * - status: status of the trigger call. OK if succeeded
 * - error: Error message in case of failure
 *
 * Accepts the following parameters:
 * - arn: The ARN of the topic for which you wish to confirm a subscription.
 * - token: Short-lived token sent to an endpoint during the Subscribe action.
 * - region: Region where the subscription is stored
 *
 * @example
 * ```sql TheButton[Confirm an SNS subscription]="Confirm an SNS subscription"
 * SELECT * FROM invoke_lambda('function_name', '{name: test}');
 * ```
 *
 * @see https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
 *
 */

export class ConfirmSubscriptionRpc extends RpcBase {
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
   * Confirm the subscription by topic ARN
   */
  async confirmSubscription(client: SNS, input: ConfirmSubscriptionCommandInput) {
    return await client.confirmSubscription(input);
  }

  /**
   * @internal
   */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    arn: string,
    token: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!arn || !token) {
      throw new Error('Please provide a valid SNS subscription ARN and a valid token.');
    }
    const clientRegion = region ?? (await ctx.getDefaultRegion());
    const client = (await ctx.getAwsClient(clientRegion)) as AWS;

    const input: ConfirmSubscriptionInput = {
      AuthenticateOnUnsubscribe: undefined,
      Token: token,
      TopicArn: arn,
    };

    try {
      const res = await this.confirmSubscription(client.snsClient, input);
      if (res && res.SubscriptionArn) {
        // ok, we have confirmed
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
            error: 'Error confirming subscription',
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
