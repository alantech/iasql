import { SNS, UnsubscribeCommandInput } from '@aws-sdk/client-sns';

import { AwsSnsModule } from '..';
import { AWS } from '../../aws_lambda/aws';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method to unsubscribe from an SNS topic
 *
 * Returns following columns:
 * - status: status of the trigger call. OK if succeeded
 * - error: Error message in case of failure
 *
 * Accepts the following parameters:
 * - arn: The ARN of the subscription you want to unsubscribe from.
 * - region: Region where the subscription is stored
 * *
 * @example
 * ```sql TheButton[Unsubscribe from an SNS topic]="Unsubscribe from an SNS topic"
 * SELECT * FROM unsubscribe('subscription_arn');
 * ```
 * @see https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
 *
 */

export class UnsubscribeRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsSnsModule;

  /**
   * @internal
   */
  outputTable = {
    status: 'varchar',
    error: 'varchar',
  } as const;

  /**
   * Unsubscribes from an specific topic
   */
  async unsubscribe(client: SNS, input: UnsubscribeCommandInput) {
    return await client.unsubscribe(input);
  }

  /**
   * @internal
   */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    arn: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!arn) {
      throw new Error('Please provide a valid SNS subscription ARN to unsubscribe.');
    }
    const clientRegion = region ?? (await ctx.getDefaultRegion());
    const client = (await ctx.getAwsClient(clientRegion)) as AWS;

    const input: UnsubscribeCommandInput = {
      SubscriptionArn: arn,
    };

    try {
      const res = await this.unsubscribe(client.snsClient, input);
      if (res) {
        // ok, we have unsubscribed
        return [
          {
            status: 'OK',
            error: '',
          },
        ];
      } else {
        return [
          {
            status: 'KO',
            error: 'Error unsubscribing',
          },
        ];
      }
    } catch (e) {
      return [
        {
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
