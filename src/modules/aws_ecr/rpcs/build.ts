import { awsCodebuildModule } from '../../aws_codebuild';
import { CodebuildProject, SourceCredentialsList, SourceType } from '../../aws_codebuild/entity';
import { awsIamModule } from '../../aws_iam';
import { IamRole } from '../../aws_iam/entity';
import { modules } from '../../iasql_functions/iasql';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import { Repository, RepositoryImage } from '../entity';
import { AwsEcrModule } from '../index';

/**
 * Method to build an image associated to an especific ECR repository
 *
 * Returns following columns:
 * - imageId: AWS generated ID for the generated image
 *
 * Accepts the following parameters:
 * - githubRepoUrl: URL where to get the source code for the build
 * - ecrRepositoryId: ID fot the repository where to push the image
 * - buildPath: Internal path on the Github repo where to read the buildspec
 * - githubRef: Git reference for the source code repo
 * - githubPersonalAccessToken: Personal Access Token used to access private repositories
 *
 * @example
 * ```sql TheButton[Trigger an ECR image build]="Trigger an ECR image build"
 * SELECT ecr_build('https://github.com/iasql/docker-helloworld',
 * (SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255), '.', 'main', '<personal_access_token>');
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecr-build-integration.ts#L104
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html
 *
 */
export class EcrBuildRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsEcrModule;

  /**
   * @internal
   */
  outputTable = {
    imageId: 'varchar',
  } as const;

  /**
   * @internal
   */
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
    githubRepoUrl: string,
    ecrRepositoryId: string,
    buildPath: string,
    githubRef: string,
    githubPersonalAccessToken: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    await this.ensureModules(dbId);

    const ecrRepository = await this.getEcrRepoById(ctx, ecrRepositoryId);
    const region = ecrRepository.region;
    const prefix = (Math.random() + 1).toString(36).substring(7);

    // create github credentials
    let credentialsArn;
    if (githubPersonalAccessToken) {
      const importCredentialResult = await awsCodebuildModule.importSourceCredential.call(
        dbId,
        dbUser,
        ctx,
        region,
        githubPersonalAccessToken,
        'GITHUB',
        'PERSONAL_ACCESS_TOKEN',
      );
      if (importCredentialResult[0].status === 'ERROR') throw new Error(importCredentialResult[0].message);
      credentialsArn = importCredentialResult[0].arn;
    }
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
    const codeBuildProject = await this.createCodebuildProject(
      codeBuildProjectName,
      buildSpec,
      githubRef,
      githubPersonalAccessToken ? githubRepoUrl : '',
      role,
      region,
      ctx,
    );

    // start build and wait for it to complete
    const buildResult = await awsCodebuildModule.startBuild.call(
      dbId,
      dbUser,
      ctx,
      codeBuildProjectName,
      region,
    );
    if (!buildResult.length || buildResult[0].status !== 'OK') {
      throw new Error(`Error when starting codebuild project: ${buildResult[0].message}`);
    }

    // get the pushed image from the cloud and create it in the DB
    const createdImage = await this.getCreatedEcrImage(ctx, ecrRepository);
    await this.module.repositoryImages.db.create(createdImage, ctx);

    // delete service role
    await awsIamModule.role.cloud.delete(role, ctx);

    // delete credentials
    if (githubPersonalAccessToken) {
      await awsCodebuildModule.sourceCredentialsList.cloud.delete(
        { arn: credentialsArn } as SourceCredentialsList, // hacky but works
        ctx,
      );
    }

    // delete codebuild project
    await awsCodebuildModule.project.cloud.delete(codeBuildProject, ctx);

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

  private async ensureModules(_dbId: string) {
    const installedModuleNames = (await modules(false, true, _dbId)).map(m => m.moduleName);
    if (!installedModuleNames.includes('aws_iam'))
      throw new Error('ecr_build needs "aws_iam" module installed to be able to create a codebuild project');
    if (!installedModuleNames.includes('aws_codebuild'))
      throw new Error('ecr_build needs "aws_codebuild" module installed to build and push your image');
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

  private async createCodebuildProject(
    projectName: string,
    buildSpec: string,
    githubRef: string,
    githubRepoUrl: string,
    role: IamRole,
    region: string,
    ctx: Context,
  ) {
    const project = await ctx.orm.newWithDefaults(CodebuildProject);
    project.projectName = projectName;
    project.buildSpec = buildSpec;
    if (githubRepoUrl) {
      project.sourceType = SourceType.GITHUB;
      project.sourceLocation = githubRepoUrl;
      project.sourceVersion = githubRef ?? 'main';
    } else project.sourceType = SourceType.NO_SOURCE;
    project.serviceRole = role;
    project.privilegedMode = true;
    project.region = region;

    const codeBuildProject = (await awsCodebuildModule.project.cloud.create(
      project,
      ctx,
    )) as CodebuildProject;
    if (!codeBuildProject) throw new Error("Couldn't create CodeBuild project");
    return codeBuildProject;
  }

  private generateBuildSpec(
    region: string,
    ecrRepositoryUri: string,
    buildPath: string,
    githubRepoUrl: string,
    githubRef: string,
  ) {
    let additionalCommands = 'echo Github repo pulled successfully using personal access token';
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
}
