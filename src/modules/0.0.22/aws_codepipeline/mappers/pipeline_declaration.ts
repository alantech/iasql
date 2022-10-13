import _ from 'lodash';

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
import { awsIamModule } from '../../aws_iam';
import { PipelineDeclaration } from '../entity';

export class PipelineDeclarationMapper extends MapperBase<PipelineDeclaration> {
  module: AwsCodepipelineModule;
  entity = PipelineDeclaration;
  equals = (a: PipelineDeclaration, b: PipelineDeclaration) => {
    // needed to avoid comparisons between undefined and not defined keys
    const stages_a = _.pickBy(a.stages, _.identity);
    const stages_b = _.pickBy(a.stages, _.identity);
    console.log('in equals');
    console.dir(stages_a, { depth: null });
    console.dir(stages_b, { depth: null });
    return (
      Object.is(a.serviceRole?.arn, b.serviceRole?.arn) &&
      Object.is(a.name, b.name) &&
      Object.is(a.artifactStore.location, b.artifactStore.location) &&
      Object.is(a.artifactStore.type, b.artifactStore.type) &&
      _.isEqual(stages_a, stages_b)
    );
  };

  async pipelineDeclarationMapper(pd: AWSPipelineDeclaration, ctx: Context) {
    if (!pd.roleArn || !pd.name) return;

    const out = new PipelineDeclaration();
    if (pd.roleArn) {
      const roleName = awsIamModule.role.roleNameFromArn(pd.roleArn, ctx);
      if (!Object.values(ctx.memo?.cloud?.IamRole ?? {}).length) {
        out.serviceRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ??
          (await awsIamModule.role.cloud.read(ctx, roleName));
      } else {
        out.serviceRole =
          (await awsIamModule.role.db.read(ctx, roleName)) ?? ctx?.memo?.cloud?.IamRole?.[roleName ?? ''];
      }
    }
    out.name = pd.name;
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

  cloud: Crud2<PipelineDeclaration> = new Crud2({
    create: async (pds: PipelineDeclaration[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const pd of pds) {
        if (!pd.name || !pd.serviceRole) continue;

        const input: CreatePipelineCommandInput = {
          pipeline: {
            name: pd.name,
            roleArn: pd.serviceRole.arn,
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
    update: async (pds: PipelineDeclaration[], ctx: Context) => {
      const out = [];
      for (const pd of pds) {
        const cloudRecord = ctx?.memo?.cloud?.PipelineDeclaration?.[pd.name ?? ''];
        // if we have modified arn, restore it
        if (pd.serviceRole.arn !== cloudRecord.serviceRole.arn) {
          pd.serviceRole = cloudRecord.serviceRole;
          await this.module.pipeline_declaration.db.update(pd, ctx);
          out.push(pd);
          continue;
        }

        // delete previous pipeline and create a new one
        await this.module.pipeline_declaration.cloud.delete([pd], ctx);
        const created = await this.module.pipeline_declaration.cloud.create(pd, ctx);
        if (!!created && created instanceof Array) out.push(...created);
        else if (!!created) out.push(created);
      }
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
