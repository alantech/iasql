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

/**
 *
 * ```testdoc
 * modules/aws-codepipeline-integration.ts#AwsCodepipeline Integration Testing#Code examples
 * ```
 */
export const awsCodepipelineModule = new AwsCodepipelineModule();
