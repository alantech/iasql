import {
  BatchGetBuildsCommandInput,
  Build,
  CodeBuild,
  CreateProjectCommandInput,
  DeleteProjectInput,
  DeleteSourceCredentialsCommandInput,
  ImportSourceCredentialsInput,
  Project,
  StartBuildInput,
} from '@aws-sdk/client-codebuild';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { BuildStatus } from '../../aws_codebuild/entity';
import { awsIamModule } from '../../aws_iam';
import { IamRole } from '../../aws_iam/entity';
import { modules } from '../../iasql_functions/iasql';
import { Repository, RepositoryImage } from '../entity';
import { AwsEcrModule } from '../index';

export class EcrBuildRpc extends RpcBase {
  module: AwsEcrModule;
  outputTable = {
    imageId: 'varchar',
  } as const;

  importSourceCredentials = crudBuilderFormat<CodeBuild, 'importSourceCredentials', string | undefined>(
    'importSourceCredentials',
    input => input,
    res => res?.arn,
  );
  deleteSourceCredentials = crudBuilder2<CodeBuild, 'deleteSourceCredentials'>(
    'deleteSourceCredentials',
    input => input,
  );

  createProject = crudBuilderFormat<CodeBuild, 'createProject', Project | undefined>(
    'createProject',
    input => input,
    res => res?.project,
  );
  startBuild = crudBuilderFormat<CodeBuild, 'startBuild', Build | undefined>(
    'startBuild',
    input => input,
    res => res?.build,
  );
  deleteProject = crudBuilder2<CodeBuild, 'deleteProject'>('deleteProject', input => input);
  async waitForBuildsToComplete(client: CodeBuild, ids: string[]) {
    // wait for policies to be attached
    const input: BatchGetBuildsCommandInput = {
      ids,
    };
    await createWaiter<CodeBuild, BatchGetBuildsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.batchGetBuilds(cmd);
          const done = data?.builds?.every(bd => bd.buildStatus !== BuildStatus.IN_PROGRESS || !!bd.endTime);
          if (done) {
            data.builds?.map(bd => {
              if (bd.buildStatus === BuildStatus.FAILED) throw new Error(`Build with arn ${bd.arn} failed.`);
            });
            return { state: WaiterState.SUCCESS };
          }
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    githubRepoUrl: string,
    ecrRepositoryId: string,
    buildPath: string,
    githubRef: string,
    githubPersonalAccessToken: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    await this.ensureAwsIamModule(_dbId);

    const ecrRepository = await this.getEcrRepoById(ctx, ecrRepositoryId);
    const region = ecrRepository.region;
    const client = (await ctx.getAwsClient(region)) as AWS;
    const prefix = (Math.random() + 1).toString(36).substring(7);

    // create github credentials
    let credentialsArn;
    if (githubPersonalAccessToken)
      credentialsArn = await this.createGithubCredentials(githubPersonalAccessToken, client);

    // create service role
    const role: IamRole = await this.createServiceRole(prefix, ctx);

    // create codebuild project
    const codeBuildProjectName = `${prefix}-ecr-builder`;
    const buildSpec = this.generateBuildSpec(
      region,
      ecrRepository.repositoryUri!,
      buildPath,
      githubPersonalAccessToken ? '' : githubRepoUrl,
      githubRef,
    );
    await this.createCodebuildProject(
      codeBuildProjectName,
      buildSpec,
      githubRef,
      githubPersonalAccessToken ? githubRepoUrl : '',
      role,
      client,
    );

    // start build and wait for it to complete
    const build = await this.startCodebuildProject(codeBuildProjectName, client);
    await this.waitForBuildsToComplete(client.cbClient, [build.id!]);

    // get the pushed image from the cloud and create it in the DB
    const createdImage = await this.getCreatedEcrImage(ctx, ecrRepository);
    this.module.repositoryImages.db.create(createdImage, ctx);

    // delete service role
    awsIamModule.role.cloud.delete(role, ctx);

    // delete credentials
    if (githubPersonalAccessToken) await this.deleteGithubCredentials(credentialsArn, client);

    // delete codebuild project
    await this.deleteCodebuildProject(codeBuildProjectName, client);

    return [
      {
        imageId: createdImage.imageId,
      },
    ];
  };

  constructor(module: AwsEcrModule) {
    super();
    this.module = module;
    super.init();
  }

  private async ensureAwsIamModule(_dbId: string) {
    const installedModules = await modules(false, true, _dbId);
    if (!installedModules.map(m => m.moduleName).includes('aws_iam')) {
      throw new Error('ecr_build RPC is only available if you have "aws_iam" module installed');
    }
  }

  private async deleteCodebuildProject(codeBuildProjectName: string, client: AWS) {
    const input: DeleteProjectInput = {
      name: codeBuildProjectName,
    };
    await this.deleteProject(client.cbClient, input);
  }

  private async deleteGithubCredentials(credentialsArn: any, client: AWS) {
    const deleteCredentialsInput: DeleteSourceCredentialsCommandInput = {
      arn: credentialsArn,
    };
    await this.deleteSourceCredentials(client.cbClient, deleteCredentialsInput);
  }

  private async getEcrRepoById(ctx: Context, ecrRepositoryId: string) {
    const ecrRepository = ((await this.module.repository.db.read(ctx)) as Repository[]).find(
      repo => repo.id === parseInt(ecrRepositoryId, 10),
    );
    if (!ecrRepository) throw new Error(`Can't find ecr repository with id ${ecrRepositoryId}.`);
    if (!ecrRepository.repositoryUri)
      throw new Error('Ecr repository does not have URI set. Try to first initialize it.');
    return ecrRepository;
  }

  private async getCreatedEcrImage(ctx: Context, ecrRepository: Repository) {
    const images = (await this.module.repositoryImages.cloud.read(ctx)) as RepositoryImage[];
    const createdImage = images.find(
      image =>
        image.privateRepository?.repositoryUri === ecrRepository?.repositoryUri &&
        image.imageTag === 'latest',
    );
    if (!createdImage) throw new Error("Can't push the image to ECR");
    return createdImage;
  }

  private async startCodebuildProject(codeBuildProjectName: string, client: AWS) {
    const startProjectInput: StartBuildInput = {
      projectName: codeBuildProjectName,
    };
    const build = await this.startBuild(client.cbClient, startProjectInput);
    if (!build || !build.id) throw new Error('Error starting build');
    return build;
  }

  private async createCodebuildProject(
    codebuildProjectName: string,
    buildSpec: string,
    githubRef: string,
    githubRepoUrl: string,
    role: IamRole,
    client: AWS,
  ) {
    let source, sourceVersion;
    if (githubRepoUrl) {
      source = {
        location: githubRepoUrl,
        type: 'GITHUB',
        buildspec: buildSpec,
      };
      sourceVersion = githubRef ?? 'main';
    } else
      source = {
        type: 'NO_SOURCE',
        buildspec: buildSpec,
      };
    const createProjectInput: CreateProjectCommandInput = {
      name: codebuildProjectName,
      environment: {
        type: 'LINUX_CONTAINER',
        image: 'aws/codebuild/standard:6.0',
        computeType: 'BUILD_GENERAL1_SMALL',
        environmentVariables: [],
        privilegedMode: true,
      },
      sourceVersion,
      source,
      serviceRole: role.arn,
      artifacts: {
        type: 'NO_ARTIFACTS',
      },
    };
    const codeBuildProject = await this.createProject(client.cbClient, createProjectInput);
    if (!codeBuildProject) throw new Error("Couldn't create CodeBuild project");
  }

  private generateBuildSpec(
    region: string,
    ecrRepositoryUri: string,
    buildPath: string,
    githubRepoUrl: string,
    githubRef: string,
  ) {
    let additionalCommands = 'echo Github repo pulled successfuly using personal access token';
    if (githubRepoUrl) {
      additionalCommands = `git clone ${githubRepoUrl} repo && cd repo && git checkout ${
        githubRef ?? 'main'
      }`;
    }
    return `version: 0.2

phases:
  pre_build:
    commands:
      - ${additionalCommands}
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${ecrRepositoryUri}
  build:
    commands:
      - echo Building the Docker image...
      - docker build -t ${ecrRepositoryUri}:latest ${buildPath ?? '.'}
  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push ${ecrRepositoryUri}:latest`;
  }

  private async createServiceRole(prefix: string, ctx: Context) {
    let role: IamRole = {
      roleName: `${prefix}-ecr-builder-codebuild-role`,
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'codebuild.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      attachedPoliciesArns: [
        'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess',
        'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess',
        'arn:aws:iam::aws:policy/AWSCodeStarFullAccess',
        'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess',
      ],
    };
    role = (await awsIamModule.role.cloud.create(role, ctx)) as IamRole;
    return role;
  }

  private async createGithubCredentials(githubPersonalAccessToken: string, client: AWS) {
    const createCredentialsInput: ImportSourceCredentialsInput = {
      token: githubPersonalAccessToken,
      serverType: 'GITHUB',
      authType: 'PERSONAL_ACCESS_TOKEN',
    };
    const credentialsArn = await this.importSourceCredentials(client.cbClient, createCredentialsInput);
    if (!credentialsArn) throw new Error('Error adding Github credentials');
    return credentialsArn;
  }
}
