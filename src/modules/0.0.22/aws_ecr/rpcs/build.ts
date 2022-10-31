import { BatchGetBuildsCommandInput, Build, CodeBuild, CreateProjectCommandInput, DeleteSourceCredentialsCommandInput, ImportSourceCredentialsInput, Project, StartBuildInput } from "@aws-sdk/client-codebuild";
import { createWaiter, WaiterState } from "@aws-sdk/util-waiter";
import { AWS, crudBuilder2, crudBuilderFormat } from "../../../../services/aws_macros";
import { Context, RpcBase, RpcResponseObject } from "../../../interfaces";
import { BuildStatus } from "../../aws_codebuild/entity";
import { awsIamModule } from "../../aws_iam";
import { IamRole } from "../../aws_iam/entity";
import { Repository, RepositoryImage } from "../entity";
import { AwsEcrModule } from "../index";


export class EcrBuildRpc extends RpcBase {
    module: AwsEcrModule;
    outputTable = {
        imageId: 'varchar'
    } as const;


    startBuild = crudBuilderFormat<CodeBuild, 'startBuild', Build | undefined>(
        'startBuild',
        input => input,
        res => res?.build,
    );

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
                        return { state: WaiterState.SUCCESS };
                    }
                    return { state: WaiterState.RETRY };
                } catch (e: any) {
                    throw e;
                }
            },
        );
    }

    createProject = crudBuilderFormat<CodeBuild, 'createProject', Project | undefined>(
        'createProject',
        input => input,
        res => res?.project,
    );

    deleteSourceCredentials = crudBuilder2<CodeBuild, 'deleteSourceCredentials'>(
        'deleteSourceCredentials',
        input => input,
    );

    importSourceCredentials = crudBuilderFormat<CodeBuild, 'importSourceCredentials', string | undefined>(
        'importSourceCredentials',
        input => input,
        res => res?.arn,
    );


    call = async (
        _dbId: string,
        _dbUser: string,
        ctx: Context,
        githubRepoUrl: string,
        ecrRepositoryId: string, // TODO: can't be number?
        githubPersonalAccessToken: string,
        region: string
    ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
        const client = (await ctx.getAwsClient(region ?? ctx.getDefaultRegion())) as AWS;

        // create github credentials
        let credentialsArn;
        if (githubPersonalAccessToken) {
            const createCredentialsInput: ImportSourceCredentialsInput = {
                token: githubPersonalAccessToken,
                serverType: 'GITHUB',
                authType: 'PERSONAL_ACCESS_TOKEN',
            };
            credentialsArn = await this.importSourceCredentials(client.cbClient, createCredentialsInput);
            if (!credentialsArn) throw new Error('Error adding Github credentials');
        }

        // create service role
        new IamRole()
        awsIamModule.role.cloud.create()

        // create codebuild project
        const ecrRepositoryUri = (await this.module.repository.db.read(ctx) as Repository[]).find(repo => repo.id === parseInt(ecrRepositoryId))?.repositoryUri;
        const buildspec = `version: 0.2
        
        phases:
          pre_build:
            commands:
              - echo Logging in to Amazon ECR...
              - aws ecr get-login-password --region ${region ?? ctx.getDefaultRegion()} | docker login --username AWS --password-stdin ${ecrRepositoryUri}
          build:
            commands:
              - echo Building the Docker image...
              - docker build -t ${ecrRepositoryUri}:latest .
          post_build:
            commands:
              - echo Pushing the Docker image...
              - docker push ${ecrRepositoryUri}:latest`;
        const prefix = (Math.random() + 1).toString(36).substring(7);;
        const codeBuildProjectName = `${prefix}-ecr-builder`;
        const createProjectInput: CreateProjectCommandInput = {
            name: codeBuildProjectName,
            environment: {
                type: 'LINUX_CONTAINER',
                image: 'aws/codebuild/standard:6.0',
                computeType: 'BUILD_GENERAL1_SMALL',
                environmentVariables: [],
                privilegedMode: true,
            },
            sourceVersion: 'main',
            source: {
                location: githubRepoUrl,
                type: 'GITHUB',
                buildspec: buildspec,
            },
            serviceRole: undefined,
            artifacts: undefined
        };
        const awsPj = await this.createProject(client.cbClient, createProjectInput);
        if (!awsPj) throw new Error("Couldn't create CodeBuild project");

        // start codebuild project
        const startProjectInput: StartBuildInput = {
            projectName: codeBuildProjectName,
        };
        const cloudBuild = await this.startBuild(client.cbClient, startProjectInput);
        if (!cloudBuild || !cloudBuild.id) throw new Error('Error starting build');
        await this.waitForBuildsToComplete(client.cbClient, [cloudBuild.id]);

        const imageId = (await this.module.repositoryImages.cloud.read(ctx) as RepositoryImage[]).find(repo => repo.privateRepository?.id === parseInt(ecrRepositoryId))?.imageId;

        // delete credentials
        if (credentialsArn) {
            const deleteCredentialsInput: DeleteSourceCredentialsCommandInput = {
                arn: credentialsArn,
            };
            await this.deleteSourceCredentials(client.cbClient, deleteCredentialsInput);
        }

        return [{
            imageId
        }];
    }

    constructor(module: AwsEcrModule) {
        super();
        this.module = module;
        super.init;
    }
}