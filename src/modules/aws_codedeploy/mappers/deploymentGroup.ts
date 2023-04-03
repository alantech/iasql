import isEqual from 'lodash.isequal';

import {
  CodeDeploy,
  CreateDeploymentGroupCommandInput,
  DeploymentGroupInfo,
  paginateListDeploymentGroups,
  UpdateDeploymentGroupCommandOutput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsIamModule } from '../../aws_iam';
import { Context, Crud, IdFields, MapperBase } from '../../interfaces';
import {
  CodedeployApplication,
  CodedeployDeploymentGroup,
  DeploymentConfigType,
  DeploymentOption,
  DeploymentType,
  EC2TagFilterType,
} from '../entity';

export class CodedeployDeploymentGroupMapper extends MapperBase<CodedeployDeploymentGroup> {
  module: AwsCodedeployModule;
  entity = CodedeployDeploymentGroup;
  entityId = (e: CodedeployDeploymentGroup) =>
    `${e.name}|${e.application.name}|${e.region}` ?? e.id.toString();
  idFields = (id: string) => {
    const [deploymentGroupName, applicationName, region] = id.split('|');
    return { deploymentGroupName, applicationName, region };
  };
  generateId = (fields: IdFields) => {
    const requiredFields = ['deploymentGroupName', 'applicationName', 'region'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.deploymentGroupName}|${fields.applicationName}|${fields.region}`;
  };
  equals = (a: CodedeployDeploymentGroup, b: CodedeployDeploymentGroup) => {
    return (
      isEqual(a.application.applicationId, b.application.applicationId) &&
      Object.is(a.deploymentConfigName, b.deploymentConfigName) &&
      Object.is(a.deploymentGroupId, b.deploymentGroupId) &&
      Object.is(a.name, b.name) &&
      isEqual(a.role?.roleName, b.role?.roleName) &&
      isEqual(a.deploymentStyle, b.deploymentStyle) &&
      isEqual(a.ec2TagFilters ?? [], b.ec2TagFilters ?? [])
    );
  };

  async deploymentGroupMapper(group: DeploymentGroupInfo, region: string, ctx: Context) {
    const out = new CodedeployDeploymentGroup();
    if (!group.applicationName || !group.deploymentGroupName) return undefined;

    out.application =
      (await this.module.application.db.read(
        ctx,
        this.module.application.generateId({ name: group.applicationName, region }),
      )) ??
      (await this.module.application.cloud.read(
        ctx,
        this.module.application.generateId({ name: group.applicationName, region }),
      ));
    out.deploymentConfigName = group.deploymentConfigName as DeploymentConfigType;

    if (group.deploymentStyle) {
      out.deploymentStyle = {
        deploymentOption: group.deploymentStyle.deploymentOption as DeploymentOption,
        deploymentType: group.deploymentStyle.deploymentType as DeploymentType,
      };
    }

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
    if (group.deploymentGroupId) out.deploymentGroupId = group.deploymentGroupId;
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

    out.region = region;
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
    appName => ({ applicationName: appName }),
  );

  deleteDeploymentGroup = crudBuilder<CodeDeploy, 'deleteDeploymentGroup'>(
    'deleteDeploymentGroup',
    input => input,
  );

  cloud: Crud<CodedeployDeploymentGroup> = new Crud({
    create: async (es: CodedeployDeploymentGroup[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: CreateDeploymentGroupCommandInput = {
          applicationName: e.application.name,
          deploymentConfigName: e.deploymentConfigName,
          deploymentGroupName: e.name,
          ec2TagFilters: e.ec2TagFilters,
          serviceRoleArn: e.role?.arn,
          deploymentStyle: e.deploymentStyle,
        };
        const groupId = await this.createDeploymentGroup(client.cdClient, input);
        if (!groupId) continue;

        // we need to read the created deployment because some default fields are added
        const dgId = this.module.deploymentGroup.generateId({
          deploymentGroupName: e.name,
          applicationName: e.application.name,
          region: e.region,
        });

        if (ctx?.memo?.cloud?.CodedeployDeploymentGroup?.[dgId]) {
          delete ctx.memo.cloud.CodedeployDeploymentGroup[dgId];
        }
        const updatedRecord = await this.module.deploymentGroup.cloud.read(ctx, dgId);
        if (updatedRecord) {
          updatedRecord.id = e.id;
          // Save the record back into the database to get the new fields updated
          await this.module.deploymentGroup.db.update(updatedRecord, ctx);
          out.push(updatedRecord);
        } else throw new Error('Error updating deployment group');
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { deploymentGroupName, applicationName, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawGroup = await this.getDeploymentGroup(client.cdClient, {
            applicationName,
            deploymentGroupName,
          });
          if (!rawGroup) return;

          // map to entity
          const group = await this.deploymentGroupMapper(rawGroup, region, ctx);
          return group;
        }
      } else {
        const out: CodedeployDeploymentGroup[] = [];
        // first need to read all applications in all region
        const apps = await this.module.application.cloud.read(ctx);
        const appNamesByRegion: { [key: string]: string[] } = {};
        apps.forEach((a: CodedeployApplication) =>
          appNamesByRegion[a.region]
            ? appNamesByRegion[a.region].push(a.name)
            : (appNamesByRegion[a.region] = [a.name]),
        );
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const regionAppNames = appNamesByRegion[region] ?? [];
            for (const appName of regionAppNames) {
              if (appName) {
                const groupNames = await this.listDeploymentGroups(client.cdClient, appName);
                for (const groupName of groupNames) {
                  const rawGroup = await this.getDeploymentGroup(client.cdClient, {
                    applicationName: appName,
                    deploymentGroupName: groupName,
                  });
                  if (!rawGroup) continue;
                  // map to entity
                  const group = await this.deploymentGroupMapper(rawGroup, region, ctx);
                  if (group) out.push(group);
                }
              }
            }
          }),
        );
        return out;
      }
    },
    update: async (groups: CodedeployDeploymentGroup[], ctx: Context) => {
      const out = [];
      for (const group of groups) {
        const client = (await ctx.getAwsClient(group.region)) as AWS;

        if (!group.application || !group.name) continue; // cannot update a deployment group without app or id
        // we always update
        const cloudRecord = ctx?.memo?.cloud?.CodedeployDeploymentGroup?.[this.entityId(group)];
        cloudRecord.id = group.id;
        if (group.deploymentGroupId !== cloudRecord.deploymentGroupId) {
          // restore
          await this.module.application.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          await this.updateDeploymentGroup(client.cdClient, {
            applicationName: group.application.name,
            currentDeploymentGroupName: group.name,
            ec2TagFilters: group.ec2TagFilters,
            serviceRoleArn: group.role?.arn,
            deploymentStyle: group.deploymentStyle,
            deploymentConfigName: group.deploymentConfigName,
          });

          // we need to read that again because some fields may have changed
          const dgId = this.module.deploymentGroup.generateId({
            deploymentGroupName: group.name,
            applicationName: group.application.name,
            region: group.region,
          });
          if (ctx?.memo?.cloud?.CodedeployDeploymentGroup?.[dgId]) {
            delete ctx.memo.cloud.CodedeployDeploymentGroup[dgId];
          }

          const updatedRecord = await this.cloud.read(ctx, dgId);
          if (updatedRecord) {
            updatedRecord.id = group.id;
            // Save the record back into the database to get the new fields updated
            await this.module.deploymentGroup.db.update(updatedRecord, ctx);
            out.push(updatedRecord);
          } else {
            throw new Error('Error updating deployment group');
          }
        }
      }
      return out;
    },
    delete: async (groups: CodedeployDeploymentGroup[], ctx: Context) => {
      for (const group of groups) {
        const client = (await ctx.getAwsClient(group.region)) as AWS;
        await this.deleteDeploymentGroup(client.cdClient, {
          applicationName: group.application.name,
          deploymentGroupName: group.name,
        });
      }
    },
  });

  db = new Crud<CodedeployDeploymentGroup>({
    create: (es: CodedeployDeploymentGroup[], ctx: Context) => ctx.orm.save(CodedeployDeploymentGroup, es),
    update: (es: CodedeployDeploymentGroup[], ctx: Context) => ctx.orm.save(CodedeployDeploymentGroup, es),
    delete: (es: CodedeployDeploymentGroup[], ctx: Context) => ctx.orm.remove(CodedeployDeploymentGroup, es),
    read: async (ctx: Context, id?: string) => {
      const { deploymentGroupName, applicationName, region } = id
        ? this.idFields(id)
        : { deploymentGroupName: undefined, applicationName: undefined, region: undefined };
      const opts =
        deploymentGroupName && applicationName && region
          ? {
              relations: ['application'],
              where: {
                name: deploymentGroupName,
                application: {
                  name: applicationName,
                  region,
                },
                region,
              },
            }
          : {};
      return await ctx.orm.find(CodedeployDeploymentGroup, opts);
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
