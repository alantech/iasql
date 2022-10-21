import { ModuleBase } from '../../interfaces';
import { LambdaFunctionMapper } from './mappers';

export class AwsLambdaModule extends ModuleBase {
  lambdaFunction: LambdaFunctionMapper;

  constructor() {
    super();
    this.lambdaFunction = new LambdaFunctionMapper(this);
    super.init();
  }
}
export const awsLambdaModule = new AwsLambdaModule();
