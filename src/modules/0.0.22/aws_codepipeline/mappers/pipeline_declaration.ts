import isEqual from 'lodash.isequal';

import {
  ArtifactStoreType,
  CodePipeline,
  CreatePipelineCommandInput,
  paginateListPipelines,
  PipelineDeclaration as AWSPipelineDeclaration,
  StageDeclaration as AWSStageDeclaration,
  StageDeclaration,
} from '@aws-sdk/client-codepipeline';

import { AwsCodepipelineModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { PipelineDeclaration } from '../entity';

export class PipelineDeclarationMapper extends MapperBase<PipelineDeclaration> {
  module: AwsCodepipelineModule;
  entity = PipelineDeclaration;
  equals = (a: PipelineDeclaration, b: PipelineDeclaration) =>
    Object.is(a.roleArn, b.roleArn) &&
    Object.is(a.name, b.name) &&
    isEqual(a.artifactStore, b.artifactStore) &&
    isEqual(a.stages, b.stages);

  async pipelineDeclarationMapper(pd: AWSPipelineDeclaration, ctx: Context) {
    const out = new PipelineDeclaration();

    out.roleArn = pd.roleArn;
    if (pd.name) out.name = pd.name;
    out.artifactStore = {
      encryptionKey: pd.artifactStore?.encryptionKey,
      location: pd.artifactStore?.location,
      type: pd.artifactStore?.type as ArtifactStoreType,
    };
    out.stages = [];
    if (pd.stages && pd.stages.length > 0) {
      for (const stage of pd.stages) {
        const newStage: StageDeclaration = {
          name: stage.name,
          actions: stage.actions,
        };
        out.stages.push(newStage);
      }
    }

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

  cloud: Crud2<PipelineDeclaration | undefined> = new Crud2({
    create: async (pds: PipelineDeclaration[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const pd of pds) {
        if (!pd.name) continue;

        const input: CreatePipelineCommandInput = {
          pipeline: {
            name: pd.name,
            roleArn: pd.roleArn,
            artifactStore: pd.artifactStore,
            stages: pd.stages as AWSStageDeclaration[],
          },
        };
        const rp = await this.createPipelineDeclaration(client.cpClient, input);
        if (rp) {
          const newPipeline = await this.pipelineDeclarationMapper(rp, ctx);
          if (newPipeline) out.push(newPipeline);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const pipeline = await this.getPipelineDeclarations(client.cpClient, {
          name: id,
        });
        if (pipeline) {
          const pipe = await this.pipelineDeclarationMapper(pipeline, ctx);
          return pipe;
        }
      } else {
        const out = [];
        const pipelines = await this.listPipelineDeclarations(client.cpClient);
        if (!pipelines || !pipelines.length) return;

        for (const pipeline of pipelines) {
          const rawPipeline = await this.getPipelineDeclarations(client.cpClient, {
            name: pipeline.name,
          });
          if (rawPipeline) {
            const newPipeline = await this.pipelineDeclarationMapper(rawPipeline, ctx);
            if (newPipeline) out.push(newPipeline);
          }
        }
        return out;
      }
    },
    updateOrReplace: (a: PipelineDeclaration, b: PipelineDeclaration) => 'replace',
    update: async (pds: PipelineDeclaration[], ctx: Context) => {
      const out = [];
      for (const pd of pds) {
        const cloudRecord = ctx?.memo?.cloud?.CodebuildProject?.[pd.name ?? ''];
        if (cloudRecord) {
          await this.module.pipeline_declaration.cloud.delete([cloudRecord], ctx);
          const pipelines = await this.module.pipeline_declaration.cloud.create([pd], ctx);
          if (pipelines) out.push(pipelines);
        }
      }
      return out;
    },
    delete: async (pds: PipelineDeclaration[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const pd of pds) {
        await this.deletePipelineDeclaration(client.cpClient, {
          name: pd.name,
        });
      }
    },
  });

  constructor(module: AwsCodepipelineModule) {
    super();
    this.module = module;
    super.init();
  }
}
