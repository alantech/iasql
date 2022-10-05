import isEqual from 'lodash.isequal';

import {
  CodeDeploy,
  CreateDeploymentCommandInput,
  CreateDeploymentGroupCommandInput,
  DeploymentGroupInfo,
  DeploymentInfo,
  paginateListDeploymentGroups,
  paginateListDeployments,
  UpdateDeploymentGroupCommandOutput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsIamModule } from '../../aws_iam';
import {
  CodedeployDeployment,
  CodedeployDeploymentGroup,
  DeploymentConfigType,
  DeploymentStatusEnum,
  EC2TagFilterType,
} from '../entity';

export class CodedeployDeploymentMapper extends MapperBase<CodedeployDeployment> {
  module: AwsCodedeployModule;
  entity = CodedeployDeployment;
  equals = (a: CodedeployDeployment, b: CodedeployDeployment) =>
    isEqual(a.application, b.application) &&
    isEqual(a.deploymentGroup, b.deploymentGroup) &&
    Object.is(a.deploymentId, b.deploymentId) &&
    Object.is(a.description, b.description) &&
    Object.is(a.externalId, b.externalId) &&
    Object.is(a.status, b.status);

  async deploymentMapper(deployment: DeploymentInfo, ctx: Context) {
    const out = new CodedeployDeployment();
    // needs to have application, deployment group and revision
    if (!deployment.applicationName || !deployment.deploymentGroupName || !deployment.revision)
      return undefined;
    out.application = await this.module.application.cloud.read(ctx, deployment.applicationName);
    out.deploymentGroup = await this.module.deploymentGroup.cloud.read(ctx, deployment.deploymentGroupName);
    out.deploymentId = deployment.deploymentId;
    out.description = deployment.description;
    out.externalId = deployment.externalId;
    out.status = deployment.status as DeploymentStatusEnum;

    return out;
  }

  createDeployment = crudBuilderFormat<CodeDeploy, 'createDeployment', string | undefined>(
    'createDeployment',
    input => input,
    res => res?.deploymentId,
  );

  getDeployment = crudBuilderFormat<CodeDeploy, 'getDeployment', DeploymentInfo | undefined>(
    'getDeployment',
    input => input,
    res => res?.deploymentInfo,
  );

  listDeployments = paginateBuilder<CodeDeploy>(
    paginateListDeployments,
    'paginateListDeployments',
    undefined,
    undefined,
    (applicationName, deploymentGroupName) => ({
      applicationName: applicationName,
      deploymentGroupName: deploymentGroupName,
    }),
  );

  cloud: Crud2<CodedeployDeployment> = new Crud2({
    create: async (es: CodedeployDeployment[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: CreateDeploymentCommandInput = {
          applicationName: e.application.name,
          deploymentGroupName: e.deploymentGroup.name,
          description: e.description,
          revision: e.revision.location,
        };
        const deploymentId = await this.createDeployment(client.cdClient, input);
        if (!deploymentId) continue;

        // we need to update id, app and deployment group
        e.deploymentId = deploymentId;

        const app =
          (await this.module.application.db.read(ctx, e.application.name)) ??
          this.module.application.cloud.read(ctx, e.application.name);
        if (app) e.application = app;

        const deploymentGroup =
          (await this.module.deploymentGroup.db.read(ctx, e.deploymentGroup.name)) ??
          this.module.deploymentGroup.cloud.read(ctx, e.deploymentGroup.name);
        if (deploymentGroup) e.deploymentGroup = deploymentGroup;

        await this.db.update(e, ctx);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, deploymentId?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (deploymentId) {
        const rawDeployment = await this.getDeployment(client.cdClient, {
          deploymentId: deploymentId,
        });
        if (!rawDeployment) return;

        // map to entity
        const deployment = await this.deploymentMapper(rawDeployment, ctx);
        return deployment;
      } else {
        // first need to read all deployment groups
        const out = [];
        const groups = await this.module.deploymentGroup.cloud.read(ctx);
        if (groups && groups.length > 0) {
          for (const group of groups) {
            if (group && group.name) {
              const deploymentIds = await this.listDeployments(
                client.cdClient,
                group.application.name,
                group.name,
              );
              for (const deploymentId of deploymentIds) {
                const rawDeployment = await this.getDeployment(client.cdClient, {
                  deploymentId: deploymentId,
                });
                if (!rawDeployment) continue;

                // map to entity
                const deployment = await this.deploymentMapper(rawDeployment, ctx);
                if (deployment) out.push(deployment);
              }
            }
          }
        }
        return out;
      }
    },
    update: async (groups: CodedeployDeployment[], ctx: Context) => {
      return;
    },
    delete: async (groups: CodedeployDeployment[], ctx: Context) => {
      return;
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
