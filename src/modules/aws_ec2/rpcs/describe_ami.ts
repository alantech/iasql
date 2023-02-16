import { DescribeImagesCommandInput, EC2 } from '@aws-sdk/client-ec2';

import { AwsEc2Module } from '..';
import { AWS } from '../../aws_lambda/aws';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

/**
 * Method for describing the attributes of a given AMI
 *
 * Accepts the following values:
 * - ami id: the ID of the image to query for
 *
 * Returns following columns:
 *
 * - attributes: A JSON blob with all the attributes for the given image
 * - status: OK if the key was created successfully
 * - message: Error message in case of failure
 *
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/describeimagescommandinput.html
 *
 */
export class DescribeAmiRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsEc2Module;

  /**
   * @internal
   */
  outputTable = {
    attributes: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /** @internal */
  inputTable: RpcInput = {
    amiId: 'varchar',
  };

  /**
   * @internal
   */
  async describeImages(client: EC2, input: DescribeImagesCommandInput) {
    const res = await client.describeImages(input);
    if (res) return res.Images;
    return undefined;
  }

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    amiId: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient()) as AWS;

    // Resolve amiId if necessary
    let id;
    if (amiId.includes('resolve:ssm:')) {
      const amiPath = amiId.split('resolve:ssm:').pop() ?? '';
      const ssmParameter = await this.module.instance.getParameter(client.ssmClient, amiPath);
      id = ssmParameter?.Parameter?.Value;
    } else id = amiId;

    const input: DescribeImagesCommandInput = {
      ImageIds: [id!],
    };

    try {
      const result = await this.describeImages(client.ec2client, input);
      if (!result && (result ?? []).length < 1) {
        return [
          {
            attributes: '',
            status: 'ERROR',
            message: 'Error reading image attributes',
          },
        ];
      }
      return [
        {
          attributes: (result ?? [])[0],
          status: 'OK',
          message: '',
        },
      ];
    } catch (e) {
      return [
        {
          attributes: '',
          status: 'KO',
          message: e,
        },
      ];
    }
  };

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
