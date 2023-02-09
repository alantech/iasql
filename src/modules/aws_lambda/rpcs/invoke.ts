import { InvokeCommandInput, InvokeCommandOutput } from '@aws-sdk/client-lambda';

import { AwsLambdaModule } from '..';
import { AWS } from '../../../services/aws_macros';
import { awsCloudwatchModule } from '../../aws_cloudwatch';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';
import { invokeFunction } from '../aws';

/**
 * Method to trigger a call to an specific Lambda function
 *
 * Returns following columns:
 * - function_name: Name of the function called
 * - version: version of the function called
 * - status: status of the trigger call. OK if succeeded
 * - payload: payload used to call the function
 * - error: Error message in case of failure
 *
 * Accepts the following parameters:
 * - functionName: Name of the Lambda function to invoke
 * - payload: payload used to call the function
 * - region: Region where the function is stored
 *
 * @see https://docs.aws.amazon.com/es_es/lambda/latest/dg/API_Invoke.html
 *
 */
export class LambdaFunctionInvokeRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsLambdaModule;

  /**
   * @internal
   */
  inputTable: RpcInput = {
    lambdaFunctionName: 'varchar',
    functionPayload: { argType: 'json', default: '{}' },
    region: { argType: 'varchar', default: 'default_aws_region()', rawDefault: true },
  };
  /**
   * @internal
   */
  outputTable = {
    function_name: 'varchar',
    version: 'varchar',
    status: 'varchar',
    payload: 'varchar',
    error: 'varchar',
  } as const;

  /**
   * @internal
   */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    functionName: string,
    payload: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!functionName) {
      throw new Error('Please provide a valid lambda function name.');
    }
    const clientRegion = region ?? (await ctx.getDefaultRegion());
    const client = (await ctx.getAwsClient(clientRegion)) as AWS;
    if (payload) {
      try {
        JSON.parse(payload);
      } catch (_) {
        throw new Error('The payload must be a valid JSON string.');
      }
    }
    const input: InvokeCommandInput = {
      FunctionName: functionName,
      Payload: new TextEncoder().encode(payload),
    };
    const res: InvokeCommandOutput | undefined = await invokeFunction(client.lambdaClient, input);
    if (!res) throw new Error('No invoke response');
    // After we invoke a lambda function a new loggroup is autogeenrated by AWS and it is not configurable.
    // If the module is installed, we need to read the db and if it is not there we need to insert it
    try {
      const lambdaLogGroupName = `/aws/lambda/${functionName}`;
      const functionLogGroup = await awsCloudwatchModule.logGroup.db.read(
        ctx,
        awsCloudwatchModule.logGroup.generateId({ logGroupName: lambdaLogGroupName, region: clientRegion }),
      );
      if (!functionLogGroup) {
        // It may take 5 to 10 minutes for logs to show up after a function invocation.
        await awsCloudwatchModule.logGroup.waitForLogGroup(client.cwClient, lambdaLogGroupName);
        const cloudFunctionLogGroup = await awsCloudwatchModule.logGroup.cloud.read(
          ctx,
          awsCloudwatchModule.logGroup.generateId({ logGroupName: lambdaLogGroupName, region: clientRegion }),
        );
        if (cloudFunctionLogGroup) {
          await awsCloudwatchModule.logGroup.db.create(cloudFunctionLogGroup, ctx);
        }
      }
    } catch (e) {
      /** Do nothing, it might be that the module is not installed */
    }
    return [
      {
        function_name: functionName,
        version: res.ExecutedVersion,
        status: `${res.StatusCode}`,
        payload: res.Payload ? new TextDecoder().decode(res.Payload) : '',
        error: res.FunctionError,
      },
    ];
  };

  constructor(module: AwsLambdaModule) {
    super();
    this.module = module;
    super.init();
  }
}
