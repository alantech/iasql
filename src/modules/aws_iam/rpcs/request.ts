import { CreateAccessKeyCommandInput, IAM } from '@aws-sdk/client-iam';

import { AwsIamModule } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

/**
 * Method for requesting a new Access Key for an IAM user
 *
 * Returns following columns:
 *
 * - status: OK if the key was created successfully
 * - message: Error message in case of failure
 * - accessKeyId: The ID for the access key
 * - secretAccessKey: The secret key used to sign requests. You will need to store it safely, as it won't be stored and shown again.
 *
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 *
 */
export class AccessKeyRequestRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsIamModule;

  /**
   * @internal
   */
  outputTable = {
    status: 'varchar',
    message: 'varchar',
    accessKeyId: 'varchar',
    secretAccessKey: 'varchar',
  } as const;

  inputTable: RpcInput = [{ argName: 'userName', argType: 'varchar' }];

  /**
   * @internal
   */
  async requestAccessKey(client: IAM, input: CreateAccessKeyCommandInput) {
    const res = await client.createAccessKey(input);
    return res.AccessKey;
  }

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    userName: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient()) as AWS;
    const result = await this.requestAccessKey(client.iamClient, {
      UserName: userName,
    });
    if (!result) {
      return [
        {
          status: 'ERROR',
          message: 'Error generating access key',
          accessKeyId: '',
          secretAccessKey: '',
        },
      ];
    } else {
      return [
        {
          status: 'SUCCESS',
          message: '',
          accessKeyId: result.AccessKeyId,
          secretAccessKey: result.SecretAccessKey,
        },
      ];
    }
  };

  constructor(module: AwsIamModule) {
    super();
    this.module = module;
    super.init();
  }
}
