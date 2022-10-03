import {
  CodeDeploy,
  CreateDeploymentGroupCommandInput,
  GenericRevisionInfo,
  paginateListDeploymentGroups,
  RevisionInfo,
  UpdateDeploymentGroupCommandOutput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodedeployDeploymentGroup } from '../entity';
import { CodedeployRevision, RevisionType } from '../entity/revision';

export class CodedeployRevisionGroupMapper extends MapperBase<CodedeployRevision> {
  module: AwsCodedeployModule;
  entity = CodedeployRevision;
  // we are not going to update any revision as you only can register new
  equals = (a: CodedeployRevision, b: CodedeployRevision) => true;

  async revisionGroupMapper(revision: RevisionInfo, ctx: Context) {
    const out = new CodedeployRevision();
    if (!revision.genericRevisionInfo?.deploymentGroups) return undefined;

    // get application from deployment groups
    for (const group of revision.genericRevisionInfo.deploymentGroups) {
      // all revisions will be for the same application
      const rawGroup: CodedeployDeploymentGroup =
        (await this.module.deploymentGroup.db.read(ctx, group)) ??
        this.module.deploymentGroup.cloud.read(ctx, group);
      if (rawGroup) {
        out.application = rawGroup.application;
      }
      break;
    }
    out.description = revision.genericRevisionInfo.description;

    // get location details
    if (revision.revisionLocation) {
      out.location = {
        githubLocation: revision.revisionLocation.gitHubLocation,
        s3Location: revision.revisionLocation.s3Location,
        revisionType: revision.revisionLocation.revisionType as RevisionType,
      };
    }

    return out;
  }

  createRevision = crudBuilderFormat<CodeDeploy, 'registerApplicationRevision', null>(
    'registerApplicationRevision',
    input => input,
    res => null,
  );

  getApplicationRevision = crudBuilderFormat<
    CodeDeploy,
    'batchGetApplicationRevisions',
    RevisionInfo[] | undefined
  >(
    'batchGetApplicationRevisions',
    input => input,
    res => res?.revisions,
  );

  listDeploymentGroups = paginateBuilder<CodeDeploy>(
    paginateListDeploymentGroups,
    'deploymentGroups',
    undefined,
    undefined,
    applicationName => ({
      applicationName: applicationName,
    }),
  );

  deleteDeploymentGroup = crudBuilder2<CodeDeploy, 'deleteDeploymentGroup'>(
    'deleteDeploymentGroup',
    input => input,
  );

  cloud: Crud2<CodedeployDeploymentGroup> = new Crud2({
    create: async (es: CodedeployDeploymentGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: CreateDeploymentGroupCommandInput = {
          applicationName: e.application.name,
          deploymentConfigName: e.deploymentConfigName,
          deploymentGroupName: e.name,
          ec2TagFilters: e.ec2TagFilters,
          serviceRoleArn: e.role?.arn,
        };
        const groupId = await this.createDeploymentGroup(client.cdClient, input);
        if (!groupId) continue;

        // we need to update group id and app
        e.id = groupId;

        const app =
          (await this.module.application.db.read(ctx, e.application.name)) ??
          this.module.application.cloud.read(ctx, e.application.name);
        if (app) e.application = app;
        await this.db.update(e, ctx);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, applicationName?: string, deploymentGroupName?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (applicationName && deploymentGroupName) {
        const rawGroup = await this.getDeploymentGroup(client.cdClient, {
          applicationName: applicationName,
          deploymentGroupName: deploymentGroupName,
        });
        if (!rawGroup) return;

        // map to entity
        const group = await this.deploymentGroupMapper(rawGroup, ctx);
        return group;
      } else {
        // first need to read all applications
        const out = [];
        const apps = await this.module.application.cloud.read(ctx);
        for (const app of apps) {
          if (app && app.name) {
            const groupNames = await this.listDeploymentGroups(client.cdClient, app.name);
            for (const groupName of groupNames) {
              const rawGroup = await this.getDeploymentGroup(client.cdClient, {
                applicationName: app.name,
                deploymentGroupName: groupName,
              });
              if (!rawGroup) return;

              // map to entity
              const group = await this.deploymentGroupMapper(rawGroup, ctx);
              if (group) out.push(group);
            }
          }
        }
        return out;
      }
    },
    update: async (groups: CodedeployDeploymentGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const group of groups) {
        if (!group.application || !group.name) continue; // cannot update a deployment group without app or id
        // we always update
        const cloudRecord = ctx?.memo?.cloud?.CodedeployDeploymentGroup?.[group.name ?? ''];
        if (group.id !== cloudRecord.id) {
          // restore
          await this.module.application.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          const res = await this.updateDeploymentGroup(client.cdClient, {
            applicationName: group.application.name,
            currentDeploymentGroupName: group.name,
            ec2TagFilters: group.ec2TagFilters,
            serviceRoleArn: group.role?.arn,
          });

          // update the db
          await this.db.update(group, ctx);
          out.push(group);
        }
      }
      return out;
    },
    delete: async (groups: CodedeployDeploymentGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const group of groups) {
        await this.deleteDeploymentGroup(client.cdClient, {
          applicationName: group.application.name,
          deploymentGroupName: group.name,
        });
      }
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
