import { ModuleBase } from '../../interfaces';
import { PipelineDeclarationMapper } from './mappers';

export class AwsCodepipelineModule extends ModuleBase {
  pipeline_declaration: PipelineDeclarationMapper;

  constructor() {
    super();
    this.pipeline_declaration = new PipelineDeclarationMapper(this);
    super.init();
  }
}
export const awsCodepipelineModule = new AwsCodepipelineModule();
