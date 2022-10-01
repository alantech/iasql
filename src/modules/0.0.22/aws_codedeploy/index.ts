import { ModuleBase } from '../../interfaces';
import { CodedeployDeploymentGroup } from './entity';
import { CodedeployApplicationMapper, CodedeployDeploymentGroupMapper } from './mappers';

export class AwsCodedeployModule extends ModuleBase {
  application: CodedeployApplicationMapper;
  deploymentGroup: CodedeployDeploymentGroupMapper;

  constructor() {
    super();
    this.application = new CodedeployApplicationMapper(this);
    this.deploymentGroup = new CodedeployDeploymentGroupMapper(this);
    super.init();
  }
}
export const awsCodedeployModule = new AwsCodedeployModule();
