import { ModuleBase } from '../interfaces';
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

  constructor() {
    super();
    // Mappers
    this.application = new CodedeployApplicationMapper(this);
    this.deploymentGroup = new CodedeployDeploymentGroupMapper(this);
    this.deployment = new CodedeployDeploymentMapper(this);
    // RPCs
    this.startDeployment = new StartDeployRPC(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-codedeploy-integration.ts#AwsCodedeploy Integration Testing#Manage Codedeploy
 * ```
 */
export const awsCodedeployModule = new AwsCodedeployModule();
