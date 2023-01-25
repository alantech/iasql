import { ModuleBase } from '../interfaces';
import { PipelineDeclarationMapper } from './mappers';

export class AwsCodepipelineModule extends ModuleBase {
  /** @internal  */
  pipelineDeclaration: PipelineDeclarationMapper;

  constructor() {
    super();
    this.pipelineDeclaration = new PipelineDeclarationMapper(this);
    super.init();
  }
}
export const awsCodepipelineModule = new AwsCodepipelineModule();
