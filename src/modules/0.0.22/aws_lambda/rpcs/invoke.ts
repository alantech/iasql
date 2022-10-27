import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import { InvokeCommandInput, InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { createWaiter } from '@aws-sdk/util-waiter';

import { AwsLambdaModule } from '..';
import { AWS } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { awsCloudwatchModule } from '../../aws_cloudwatch';
import { invokeFunction } from '../aws';

export class LambdaFunctionInvokeRpc extends RpcBase {
  module: AwsLambdaModule;
  outputTable = {
    function_name: 'varchar',
    version: 'varchar',
    status: 'varchar',
    payload: 'varchar',
    error: 'varchar',
  } as const;

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
