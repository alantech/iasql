import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { PipelineDeclarationMapper } from './mappers';

export class AwsCodepipelineModule extends ModuleBase {
  /** @internal  */
  pipelineDeclaration: PipelineDeclarationMapper;
  invokeCodepipeline: AwsSdkInvoker;

  constructor() {
    super();
    this.pipelineDeclaration = new PipelineDeclarationMapper(this);
    this.invokeCodepipeline = new AwsSdkInvoker('cpClient', this);
    super.init();
  }
}
export const awsCodepipelineModule = new AwsCodepipelineModule();
