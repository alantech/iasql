import { Build, CodeBuild } from '@aws-sdk/client-codebuild';

import { AwsCodebuildModule } from '..';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method for triggering the build of a project
 *
 * Returns following columns:
 *
 * - name: the name of the project that was built
 *
 * - status: OK if the build was started successfully
 *
 * - message: Error message in case of failure
 *
 * @see https://docs.aws.amazon.com/cli/latest/reference/codebuild/start-build.html
 *
 */
export class StartBuildRPC extends RpcBase {
  /** @internal */
  module: AwsCodebuildModule;

  /** @internal */
  outputTable = {
    name: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /** @internal */
  startBuild = crudBuilderFormat<CodeBuild, 'startBuild', Build | undefined>(
    'startBuild',
    input => input,
    res => res?.build,
  );

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    name: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!name) {
      return [
        {
          name: '',
          status: 'ERROR',
          message: 'Please provide the name of the CodeBuild project to build',
        },
      ];
    }

    // given the project name, read the details
    const projectObj =
      (await this.module.project.db.read(
        ctx,
        this.module.project.generateId({ projectName: name, region }),
      )) ??
      (await this.module.project.cloud.read(
        ctx,
        this.module.project.generateId({ projectName: name, region }),
      ));

    if (!projectObj) {
      return [
        {
          name,
          status: 'Codebuild project not found',
          message: '',
        },
      ];
    }

    const client = (await ctx.getAwsClient(projectObj.region)) as AWS;
    const cloudBuild = await this.startBuild(client.cbClient, {
      projectName: name,
    });
    if (!cloudBuild || !cloudBuild.id) {
      return [
        {
          name,
          status: 'KO',
          message: 'Error launching build',
        },
      ];
    }

    // wait for builds to complete
    await this.module.buildList.waitForBuildsToComplete(client.cbClient, [cloudBuild.id]);

    // get latest status of the build
    const awsId = cloudBuild.id;

    const currentBuildList = await this.module.buildList.cloud.read(
      ctx,
      this.module.buildList.generateId({ awsId, region }),
    );

    if (!currentBuildList) {
      return [
        {
          name,
          status: 'KO',
          message: 'Error getting status of build',
        },
      ];
    }

    // modify the status of the build with the current one
    cloudBuild.buildStatus = currentBuildList.buildStatus;
    const dbBuild = await this.module.buildList.buildListMapper(cloudBuild, ctx, projectObj.region);

    if (!dbBuild) {
      return [
        {
          name,
          status: 'KO',
          message: 'Error starting build',
        },
      ];
    }

    return [
      {
        name,
        status: 'OK',
        message: '',
      },
    ];
  };

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}
