import {
  CodeDeploy,
  CreateDeploymentCommandInput,
  RevisionLocation,
  waitUntilDeploymentSuccessful,
} from '@aws-sdk/client-codedeploy';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method for deploying a CodeDeploy application revision through a deployment group.
 *
 * Accepts the following parameters:
 *
 * - application: name of the application to deploy
 *
 * - deployment group: name of the deployment group to use
 *
 * - revision: complex type specifying the type and location of the revision to deploy
 *
 * - region: region where to trigger the deployment
 *
 * Returns following columns:
 *
 * - id: the ID of the triggered deployment
 *
 * - status: OK if the build was started successfully
 *
 * - message: Error message in case of failure
 *
 * @example
 * ```sql TheButton[Deploy CodeDeploy application]="Deploy CodeDeploy application"
 *   select * from start_deployment('test', 'test', '{
 * "revisionType": "GitHub",
 * "gitHubLocation": {
 *   "repository": "iasql/iasql-codedeploy-example",
 *   "commitId": "cf6aa63cbd2502a5d1064363c2af5c56cc2107cc"
 * }
 * }', 'us-east-2');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L313
 * @see https://docs.aws.amazon.com/cli/latest/reference/deploy/create-deployment.html
 *
 */
export class StartDeployRPC extends RpcBase {
  /** @internal */
  module: AwsCodedeployModule;

  /** @internal */
  outputTable = {
    id: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /** @internal */
  private makeError(message: string, deploymentId?: string | undefined) {
    return [
      {
        id: deploymentId ?? '',
        status: 'KO',
        message,
      },
    ];
  }

  /** @internal */
  private makeSuccess(deploymentId: string) {
    return [
      {
        id: deploymentId,
        status: 'OK',
        message: '',
      },
    ];
  }

  /** @internal */
  startDeploy = crudBuilderFormat<CodeDeploy, 'createDeployment', string | undefined>(
    'createDeployment',
    input => input,
    res => res?.deploymentId,
  );

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    applicationName: string,
    deploymentGroupName: string,
    revision: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!applicationName)
      return this.makeError('Please provide the name of the CodeDeploy application to deploy');
    if (!deploymentGroupName) return this.makeError('Please provide the name of the DeploymentGroup to use');
    if (!revision) return this.makeError('Please provide the specification of the RevisionLocation to use');
    if (!region) return this.makeError('Please provide the region of the CodeDeploy application to deploy');

    // validate if application name exists
    const appObj =
      (await this.module.application.db.read(
        ctx,
        this.module.application.generateId({ name: applicationName, region }),
      )) ??
      (await this.module.application.cloud.read(
        ctx,
        this.module.application.generateId({ name: applicationName, region }),
      ));

    if (!appObj) return this.makeError('CodeDeploy application not found');

    // validate if deployment group name exists
    if (deploymentGroupName) {
      const dgObj =
        (await this.module.deploymentGroup.db.read(
          ctx,
          this.module.deploymentGroup.generateId({ deploymentGroupName, applicationName, region }),
        )) ??
        (await this.module.deploymentGroup.cloud.read(
          ctx,
          this.module.deploymentGroup.generateId({ deploymentGroupName, applicationName, region }),
        ));

      if (!dgObj) return this.makeError('CodeDeploy deployment group not found');
    }

    const client = (await ctx.getAwsClient(region)) as AWS;
    const revisionObj: RevisionLocation = JSON.parse(revision);
    const input: CreateDeploymentCommandInput = {
      applicationName,
      deploymentGroupName,
      revision: revisionObj,
      ignoreApplicationStopFailures: true,
    };
    const deploymentId = await this.startDeploy(client.cdClient, input);

    if (!deploymentId) return this.makeError('Error creating deployment');

    // wait until deployment is succeeded
    const result = await waitUntilDeploymentSuccessful(
      {
        client: client.cdClient,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<CodeDeploy>,
      { deploymentId },
    );

    return this.makeSuccess(deploymentId);
  };

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
