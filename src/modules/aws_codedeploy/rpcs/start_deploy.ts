import { CodeDeploy, RevisionLocation, waitUntilDeploymentSuccessful } from '@aws-sdk/client-codedeploy';
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
 * - region: region where to trigger the deployment
 *
 * - deployment group (optional): name of the deployment group to use
 *
 * - revision (optional): complex type specifying the type and location of the revision to deploy
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
 *   SELECT * FROM start_deploy('application_name', 'deployment_group_name', 'revision');
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
    region: string,
    deploymentGroupName?: string | undefined,
    revision?: string | undefined,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!applicationName) {
      return [
        {
          id: '',
          status: 'ERROR',
          message: 'Please provide the name of the CodeDeploy application to deploy',
        },
      ];
    }
    if (!region) {
      return [
        {
          id: '',
          status: 'ERROR',
          message: 'Please provide the region of the CodeDeploy application to deploy',
        },
      ];
    }

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

    if (!appObj) {
      return [
        {
          id: '',
          status: 'CodeDeploy application not found',
          message: '',
        },
      ];
    }

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

      if (!appObj) {
        return [
          {
            id: '',
            status: 'CodeDeploy deployment group not found',
            message: '',
          },
        ];
      }
    }

    const client = (await ctx.getAwsClient(region)) as AWS;
    const deploymentId = await this.startDeploy(client.cdClient, {
      applicationName,
      deploymentGroupName,
      revision,
      region,
    });

    if (!deploymentId) {
      return [
        {
          id: '',
          status: 'KO',
          message: 'Error creating deployment',
        },
      ];
    }

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

    // get latest status of the deploy
    const currentDeploy = await this.module.deployment.cloud.read(
      ctx,
      this.module.deployment.generateId({ deploymentId, region }),
    );

    if (!currentDeploy) {
      return [
        {
          id: deploymentId,
          status: 'KO',
          message: 'Error getting status of deployment',
        },
      ];
    }

    const dbDeploy = await this.module.deployment.deploymentMapper(currentDeploy, region, ctx);
    if (!dbDeploy) {
      return [
        {
          id: deploymentId,
          status: 'KO',
          message: 'Error starting deployment',
        },
      ];
    }

    // create the deploy in the database
    await this.module.deployment.db.create(dbDeploy, ctx);

    return [
      {
        id: deploymentId,
        status: 'OK',
        message: '',
      },
    ];
  };

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
