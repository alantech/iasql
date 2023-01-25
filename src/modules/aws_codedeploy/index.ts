import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import {
  CodedeployApplicationMapper,
  CodedeployDeploymentGroupMapper,
  CodedeployDeploymentMapper,
} from './mappers';
import { StartDeployRPC } from './rpcs';

export class AwsCodedeployModule extends ModuleBase {
  /** @internal */
  application: CodedeployApplicationMapper;

  /** @internal */
  deploymentGroup: CodedeployDeploymentGroupMapper;

  /** @internal */
  deployment: CodedeployDeploymentMapper;

  startDeployment: StartDeployRPC;

  invokeCodedeploy: AwsSdkInvoker;

  constructor() {
    super();
    this.application = new CodedeployApplicationMapper(this);
    this.deploymentGroup = new CodedeployDeploymentGroupMapper(this);
    this.deployment = new CodedeployDeploymentMapper(this);
    this.startDeployment = new StartDeployRPC(this);
    this.invokeCodedeploy = new AwsSdkInvoker('cdClient', this);
    super.init();
  }
}
export const awsCodedeployModule = new AwsCodedeployModule();
