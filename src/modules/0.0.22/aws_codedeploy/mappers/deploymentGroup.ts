import isEqual from 'lodash.isequal';

import {
  CodeDeploy,
  CreateDeploymentGroupCommandInput,
  DeploymentGroupInfo,
  paginateListDeploymentGroups,
  UpdateDeploymentGroupCommandOutput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsIamModule } from '../../aws_iam';
import { CodedeployDeploymentGroup, DeploymentConfigType, EC2TagFilterType } from '../entity';

export class CodedeployDeploymentGroupMapper extends MapperBase<CodedeployDeploymentGroup> {
  module: AwsCodedeployModule;
  entity = CodedeployDeploymentGroup;
  equals = (a: CodedeployDeploymentGroup, b: CodedeployDeploymentGroup) =>
    isEqual(a.application, b.application) &&
    Object.is(a.deploymentConfigName, b.deploymentConfigName) &&
    Object.is(a.id, b.id) &&
    Object.is(a.name, b.name) &&
    isEqual(a.role, b.role) &&
    isEqual(a.ec2TagFilters ?? [], b.ec2TagFilters ?? []);

  async deploymentGroupMapper(group: DeploymentGroupInfo, ctx: Context) {
    const out = new CodedeployDeploymentGroup();
    if (!group.applicationName || !group.deploymentGroupName) return undefined;

    out.application = await this.module.application.cloud.read(ctx, group.applicationName);
    out.deploymentConfigName =
      (group.deploymentConfigName as DeploymentConfigType) ?? DeploymentConfigType.ONE_AT_A_TIME;

    // update ec2 filters
    if (group.ec2TagFilters) {
      const filters = [];
      for (const rawFilter of group.ec2TagFilters) {
        const filter = {
          Key: rawFilter.Key,
          Type: rawFilter.Type as EC2TagFilterType,
          Value: rawFilter.Value,
        };
        filters.push(filter);
      }
      out.ec2TagFilters = filters;
    }
    if (group.deploymentGroupId) out.id = group.deploymentGroupId;
    out.name = group.deploymentGroupName;

    if (group.serviceRoleArn) {
      // we need to list all roles and get the one with matching ARN
      const roleName = awsIamModule.role.roleNameFromArn(group.serviceRoleArn, ctx);
      try {
        const role =
          (await awsIamModule.role.db.read(ctx, roleName)) ??
          (await awsIamModule.role.cloud.read(ctx, roleName));
        if (role) {
          out.role = role;
        }
      } catch (_) {
        /** Do nothing */
      }
    }

    return out;
  }

  createDeploymentGroup = crudBuilderFormat<CodeDeploy, 'createDeploymentGroup', string | undefined>(
    'createDeploymentGroup',
    input => input,
    res => res?.deploymentGroupId,
  );

  getDeploymentGroup = crudBuilderFormat<CodeDeploy, 'getDeploymentGroup', DeploymentGroupInfo | undefined>(
    'getDeploymentGroup',
    input => input,
    res => res?.deploymentGroupInfo,
  );

  updateDeploymentGroup = crudBuilderFormat<
    CodeDeploy,
    'updateDeploymentGroup',
    UpdateDeploymentGroupCommandOutput | undefined
  >(
    'updateDeploymentGroup',
    input => input,
    res => res,
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
        if (apps && apps.length > 0) {
          for (const app of apps) {
            if (app && app.name) {
              const groupNames = await this.listDeploymentGroups(client.cdClient, app.name);
              for (const groupName of groupNames) {
                const rawGroup = await this.getDeploymentGroup(client.cdClient, {
                  applicationName: app.name,
                  deploymentGroupName: groupName,
                });
                if (!rawGroup) continue;

                // map to entity
                const group = await this.deploymentGroupMapper(rawGroup, ctx);
                if (group) out.push(group);
              }
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
