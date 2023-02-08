import { ModuleBase } from '../interfaces';
import { LambdaFunctionMapper } from './mappers';
import { LambdaFunctionInvokeRpc } from './rpcs';

/**
 * @internal
 */
export class AwsLambdaModule extends ModuleBase {
  /** @internal */
  lambdaFunction: LambdaFunctionMapper;

  invokeLambdaFunction: LambdaFunctionInvokeRpc;

  constructor() {
    super();
    this.lambdaFunction = new LambdaFunctionMapper(this);
    this.invokeLambdaFunction = new LambdaFunctionInvokeRpc(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-lambda-integration.ts#Lambda Integration Testing#Manage Lambda functions
 * ```
 */
export const awsLambdaModule = new AwsLambdaModule();
