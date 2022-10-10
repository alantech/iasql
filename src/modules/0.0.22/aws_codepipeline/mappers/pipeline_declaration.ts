import isEqual from 'lodash.isequal';

import {
  CodePipeline,
  CreatePipelineCommandInput,
  paginateListPipelines,
  PipelineDeclaration as AWSPipelineDeclaration,
  StageDeclaration as AWSStageDeclaration,
} from '@aws-sdk/client-codepipeline';

import { AwsCodepipelineModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { PipelineDeclaration } from '../entity';

export class CodepipelineProjectMapper extends MapperBase<PipelineDeclaration> {
  module: AwsCodepipelineModule;
  entity = PipelineDeclaration;
  equals = (a: PipelineDeclaration, b: PipelineDeclaration) =>
    Object.is(a.arn, b.arn) &&
    Object.is(a.name, b.name) &&
    isEqual(a.artifactStore, b.artifactStore) &&
    isEqual(a.stages, b.stages);

  async pipelineDeclarationMapper(pd: PipelineDeclaration, ctx: Context) {
    const out = new PipelineDeclaration();
    if (!pd.name) return undefined;

    out.arn = pd.arn;
    out.artifactStore = pd.artifactStore;
    out.stages = pd.stages;
    return out;
  }

  createPipelineDeclaration = crudBuilderFormat<
    CodePipeline,
    'createPipeline',
    AWSPipelineDeclaration | undefined
  >(
    'createPipeline',
    input => input,
    res => res?.pipeline,
  );

  getPipelineDeclarations = crudBuilderFormat<
    CodePipeline,
    'getPipeline',
    AWSPipelineDeclaration | undefined
  >(
    'getPipeline',
    input => input,
    res => res?.pipeline,
  );

  listPipelineDeclarations = paginateBuilder<CodePipeline>(paginateListPipelines, 'pipelines');

  deletePipelineDeclaration = crudBuilder2<CodePipeline, 'deletePipeline'>('deletePipeline', input => input);

  cloud: Crud2<PipelineDeclaration> = new Crud2({
    create: async (es: PipelineDeclaration[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: CreatePipelineCommandInput = {
          pipeline: {
            name: e.name,
            roleArn: e.roleArn,
            artifactStore: e.artifactStore,
            stages: e.stages as AWSStageDeclaration[],
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
    updateOrReplace: (a: CodebuildProject, b: CodebuildProject) =>
      a.arn !== b.arn && this.module.project.equals(a, { ...b, arn: a.arn }) ? 'update' : 'replace',
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
