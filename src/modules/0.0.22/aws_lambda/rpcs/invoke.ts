import { InvokeCommandInput, InvokeCommandOutput } from '@aws-sdk/client-lambda';

import { AwsLambdaModule } from '..';
import { AWS } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
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
      throw new Error('Plase provide a valid lambda function name.');
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
