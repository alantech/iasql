import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { LambdaFunctionMapper } from './mappers';
import { LambdaFunctionInvokeRpc } from './rpcs';

/**
 * @internal
 */
export class AwsLambdaModule extends ModuleBase {
  /** @internal */
  lambdaFunction: LambdaFunctionMapper;

  invokeLambdaFunction: LambdaFunctionInvokeRpc;

  invokeLambda: AwsSdkInvoker;

  constructor() {
    super();
    this.lambdaFunction = new LambdaFunctionMapper(this);
    this.invokeLambdaFunction = new LambdaFunctionInvokeRpc(this);
    this.invokeLambda = new AwsSdkInvoker('acmClient', this);
    super.init();
  }
}
export const awsLambdaModule = new AwsLambdaModule();
