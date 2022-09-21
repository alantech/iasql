import {
  CodeBuild,
  BatchGetProjectsCommandInput,
  CreateProjectCommandInput,
  DeleteProjectInput,
  paginateListProjects,
  Project,
} from '@aws-sdk/client-codebuild';

import { AwsCodebuildModule } from '..';
import { awsIamModule } from '../..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodebuildProject, ComputeType, EnvironmentType, SourceType } from '../entity';

export class CodebuildProjectMapper extends MapperBase<CodebuildProject> {
  module: AwsCodebuildModule;
  entity = CodebuildProject;
  equals = (a: CodebuildProject, b: CodebuildProject) =>
    Object.is(a.projectName, b.projectName) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.buildSpec, b.buildSpec) &&
    Object.is(a.sourceLocation, b.sourceLocation) &&
    Object.is(a.sourceVersion, b.sourceVersion) &&
    Object.is(a.sourceType, b.sourceType) &&
    Object.is(a.image, b.image) &&
    Object.is(a.serviceRole?.arn, b.serviceRole?.arn) &&
    Object.is(a.computeType, b.computeType) &&
    Object.is(a.privilegedMode, b.privilegedMode) &&
    Object.is(a.environmentType, b.environmentType);

  async projectMapper(pj: Project, ctx: Context) {
    const out = new CodebuildProject();
    if (!pj?.name) return undefined;
    out.projectName = pj.name;
    out.buildSpec = pj.source?.buildspec;
    out.computeType = (pj.environment?.computeType as ComputeType) ?? ComputeType.BUILD_GENERAL1_SMALL;
    out.environmentType = (pj.environment?.type as EnvironmentType) ?? EnvironmentType.LINUX_CONTAINER;
    out.image = pj.environment?.image ?? 'aws/codebuild/standard:6.0';
    out.privilegedMode = pj.environment?.privilegedMode ?? true;
    out.sourceLocation = pj.source?.location ?? '';
    out.arn = pj.arn;
    out.sourceVersion = pj.sourceVersion;
    out.sourceType = pj.source?.type as SourceType;
    if (pj.serviceRole) {
      const roleName = awsIamModule.role.roleNameFromArn(pj.serviceRole, ctx);
      if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
        out.serviceRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ??
          (await awsIamModule.role.cloud.read(ctx, roleName));
      } else {
        out.serviceRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ?? ctx?.memo?.cloud?.Role?.[roleName ?? ''];
      }
    }
    return out;
  }

  createProject = crudBuilderFormat<CodeBuild, 'createProject', Project | undefined>(
    'createProject',
    input => input,
    res => res?.project,
  );

  getProjects = crudBuilderFormat<CodeBuild, 'batchGetProjects', Project[] | undefined>(
    'batchGetProjects',
    input => input,
    res => res?.projects,
  );

  listProjects = paginateBuilder<CodeBuild>(paginateListProjects, 'projects');

  deleteProject = crudBuilder2<CodeBuild, 'deleteProject'>('deleteProject', input => input);

  cloud: Crud2<CodebuildProject> = new Crud2({
    create: async (es: CodebuildProject[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: CreateProjectCommandInput = {
          name: e.projectName,
          environment: {
            type: e.environmentType,
            image: e.image,
            computeType: e.computeType,
            environmentVariables: e.environmentVariables,
            privilegedMode: e.privilegedMode,
          },
          sourceVersion: e.sourceVersion,
          source: {
            location: e.sourceLocation,
            type: e.sourceType,
            buildspec: e.buildSpec,
          },
          serviceRole: e.serviceRole?.arn,
          // TODO implement artifacts
          artifacts: {
            type: 'NO_ARTIFACTS',
          },
        };
        const awsPj = await this.createProject(client.cbClient, input);
        if (!awsPj) continue;
        const newPj = await this.projectMapper(awsPj, ctx);
        if (newPj) out.push(newPj);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const input: BatchGetProjectsCommandInput = {
          names: [id],
        };
        const pjs = await this.getProjects(client.cbClient, input);
        if (!pjs || pjs.length !== 1) return;
        const pj = await this.projectMapper(pjs[0], ctx);
        if (!pj) return;
        return pj;
      } else {
        const pjIds = await this.listProjects(client.cbClient);
        if (!pjIds || !pjIds.length) return;
        const input: BatchGetProjectsCommandInput = {
          names: pjIds,
        };
        const pjs = await this.getProjects(client.cbClient, input);
        if (!pjs) return;
        const out = [];
        for (const pj of pjs) {
          const outPj = await this.projectMapper(pj, ctx);
          if (outPj) out.push(outPj);
        }
        return out;
      }
    },
    updateOrReplace: (_a: CodebuildProject, _b: CodebuildProject) => 'replace',
    update: async (pjs: CodebuildProject[], ctx: Context) => {
      const out = [];
      for (const pj of pjs) {
        const cloudRecord = ctx?.memo?.cloud?.CodebuildProject?.[pj.projectName ?? ''];
        if (pj.arn !== cloudRecord.arn) {
          pj.arn = cloudRecord.arn;
          if (this.module.project.equals(pj, cloudRecord)) {
            await this.module.project.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
            continue;
          }
        }
        await this.module.project.cloud.delete(pj, ctx);
        const created = await this.module.project.cloud.create(pj, ctx);
        if (!!created && created instanceof Array) {
          out.push(...created);
        } else if (!!created) {
          out.push(created);
        }
      }
    },
    delete: async (pjs: CodebuildProject[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const pj of pjs) {
        const input: DeleteProjectInput = {
          name: pj.projectName,
        };
        await this.deleteProject(client.cbClient, input);
      }
    },
  });

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}
