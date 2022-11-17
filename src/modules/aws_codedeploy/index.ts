import { ModuleBase } from '../interfaces';
import {
  CodedeployApplicationMapper,
  CodedeployDeploymentGroupMapper,
  CodedeployDeploymentMapper,
} from './mappers';

export class AwsCodedeployModule extends ModuleBase {
  application: CodedeployApplicationMapper;
  deploymentGroup: CodedeployDeploymentGroupMapper;
  deployment: CodedeployDeploymentMapper;

  constructor() {
    super();
    this.application = new CodedeployApplicationMapper(this);
    this.deploymentGroup = new CodedeployDeploymentGroupMapper(this);
    this.deployment = new CodedeployDeploymentMapper(this);
    super.init();
  }
}
export const awsCodedeployModule = new AwsCodedeployModule();
