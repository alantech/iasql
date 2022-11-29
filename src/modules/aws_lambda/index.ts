import { ModuleBase } from '../interfaces';
import { LambdaFunctionMapper } from './mappers';
import { LambdaFunctionInvokeRpc } from './rpcs';

export class AwsLambdaModule extends ModuleBase {
  lambdaFunction: LambdaFunctionMapper;
  invokeLambda: LambdaFunctionInvokeRpc;

  constructor() {
    super();
    this.lambdaFunction = new LambdaFunctionMapper(this);
    this.invokeLambda = new LambdaFunctionInvokeRpc(this);
    super.init();
  }
}
export const awsLambdaModule = new AwsLambdaModule();
