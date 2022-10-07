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
  waitUntilDeploymentSuccessful,
} from '@aws-sdk/client-codedeploy';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodedeployDeployment, DeploymentStatusEnum } from '../entity';

export class CodedeployDeploymentMapper extends MapperBase<CodedeployDeployment> {
  module: AwsCodedeployModule;
  entity = CodedeployDeployment;
  equals = (a: CodedeployDeployment, b: CodedeployDeployment) => {
    return (
      isEqual(a.application.name, b.application.name) &&
      isEqual(a.deploymentGroup.name, b.deploymentGroup.name) &&
      Object.is(a.deploymentId, b.deploymentId) &&
      Object.is(a.description, b.description) &&
      Object.is(a.externalId, b.externalId) &&
      Object.is(a.status, b.status)
    );
  };

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

  listDeployments = paginateBuilder<CodeDeploy>(paginateListDeployments, 'deployments');

  cloud: Crud2<CodedeployDeployment> = new Crud2({
    create: async (es: CodedeployDeployment[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        // if we do not have application, deployment group or revision, continue
        if (!e.application || !e.deploymentGroup || !e.revision) continue;

        const input: CreateDeploymentCommandInput = {
          applicationName: e.application.name,
          deploymentGroupName: e.deploymentGroup.name,
          description: e.description,
          revision: e.revision.location,
        };
        const deploymentId = await this.createDeployment(client.cdClient, input);
        if (!deploymentId) continue;
        e.deploymentId = deploymentId;

        // wait until deployment is succeeded
        const result = await waitUntilDeploymentSuccessful(
          {
            client: client.cdClient,
            // all in seconds
            maxWaitTime: 3600,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<CodeDeploy>,
          { deploymentId: deploymentId },
        );

        if (result.state == 'SUCCESS') {
          e.status = DeploymentStatusEnum.SUCCEEDED;
          await this.db.update(e, ctx);
          out.push(e);
        }
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
        const out = [];
        const deploymentIds = await this.listDeployments(client.cdClient);
        for (const deploymentId of deploymentIds) {
          const rawDeployment = await this.getDeployment(client.cdClient, {
            deploymentId: deploymentId,
          });
          if (!rawDeployment) continue;

          // map to entity
          const deployment = await this.deploymentMapper(rawDeployment, ctx);
          if (deployment) out.push(deployment);
        }
        return out;
      }
    },
    update: async (deployments: CodedeployDeployment[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const deployment of deployments) {
        if (!deployment.application || !deployment.deploymentGroup) continue; // cannot update a deployment group without app or id

        // we just need to replace the record. We keep the initial revision, as it cannot be retrieved from mapper
        const cloudRecord = ctx?.memo?.cloud?.CodedeployDeployment?.[deployment.deploymentId ?? ''];
        cloudRecord.revision = deployment.revision;
        cloudRecord.id = deployment.id;
        await this.module.deployment.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
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
