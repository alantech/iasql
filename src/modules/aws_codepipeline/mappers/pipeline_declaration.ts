import _ from 'lodash';

import {
  ArtifactStoreType,
  CodePipeline,
  CreatePipelineCommandInput,
  GetPipelineStateCommandInput,
  paginateListPipelines,
  PipelineDeclaration as AWSPipelineDeclaration,
  StageDeclaration as AWSStageDeclaration,
  StageDeclaration,
} from '@aws-sdk/client-codepipeline';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsCodepipelineModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsIamModule } from '../../aws_iam';
import { Context, Crud, MapperBase } from '../../interfaces';
import { PipelineDeclaration } from '../entity';
import supportedRegions from './supported_regions';

export class PipelineDeclarationMapper extends MapperBase<PipelineDeclaration> {
  module: AwsCodepipelineModule;
  entity = PipelineDeclaration;
  equals = (a: PipelineDeclaration, b: PipelineDeclaration) => {
    // needed to avoid comparisons between undefined and not defined keys
    const stagesA = _.pickBy(a.stages, _.identity);
    const stagesB = _.pickBy(a.stages, _.identity);
    return (
      Object.is(a.serviceRole?.arn, b.serviceRole?.arn) &&
      Object.is(a.artifactStore.location, b.artifactStore.location) &&
      Object.is(a.artifactStore.type, b.artifactStore.type) &&
      _.isEqual(stagesA, stagesB)
    );
  };

  async pipelineDeclarationMapper(pd: AWSPipelineDeclaration, ctx: Context, region: string) {
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
    out.region = region;
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
  deletePipelineDeclaration = crudBuilder<CodePipeline, 'deletePipeline'>('deletePipeline', input => input);

  async waitForPipelineExecution(client: CodePipeline, name: string) {
    const result = await createWaiter<CodePipeline, GetPipelineStateCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        name,
      },
      async (cl, cmd) => {
        let pipelinePending = true;
        try {
          const data = await cl.getPipelineState(cmd);
          let succeededStates = 0;
          if (data.stageStates && data.stageStates.length > 0) {
            for (const state of data.stageStates) {
              // first we check if there is any failure
              if (state && state.actionStates) {
                for (const action of state.actionStates) {
                  const latestStatus = action.latestExecution?.status;
                  if (
                    latestStatus &&
                    ['Cancelled', 'Stopped', 'Superseeded', 'Failed'].includes(latestStatus)
                  ) {
                    // pipeline has failed, we can stop it
                    pipelinePending = false;
                    break;
                  }
                }
              }
              if (!pipelinePending) break;
              // then we check if the stage completed successfully
              if (state.latestExecution?.status === 'Succeeded') succeededStates++;
            }
          }
          // all stages have succeeded, we are ok
          if (succeededStates === data.stageStates?.length) pipelinePending = false;

          if (!pipelinePending) return { state: WaiterState.SUCCESS };
          else return { state: WaiterState.RETRY };
        } catch (e: any) {
          throw e;
        }
      },
    );
    return result;
  }

  cloud: Crud<PipelineDeclaration> = new Crud({
    create: async (pds: PipelineDeclaration[], ctx: Context) => {
      const out = [];
      for (const pd of pds) {
        if (!pd.name || !pd.serviceRole || !pd.region) continue;
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        if (!enabledRegions.includes(pd.region)) continue;

        const client = (await ctx.getAwsClient(pd.region)) as AWS;

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
          const newPipeline = await this.pipelineDeclarationMapper(rp, ctx, pd.region);
          if (newPipeline) {
            // wait until the execution is finished
            const result = await this.waitForPipelineExecution(client.cpClient, pd.name);
            if (result.state === WaiterState.SUCCESS) out.push(newPipeline);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { region, name } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          if (supportedRegions.includes(region)) {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const pipeline = await this.getPipelineDeclarations(client.cpClient, {
              name,
            });
            if (pipeline) {
              const pipe = await this.pipelineDeclarationMapper(pipeline, ctx, region);
              return pipe;
            }
          }
        }
      } else {
        const out: PipelineDeclaration[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            if (supportedRegions.includes(region)) {
              const client = (await ctx.getAwsClient(region)) as AWS;

              const pipelines = await this.listPipelineDeclarations(client.cpClient);
              if (!pipelines || !pipelines.length) return;

              for (const pipeline of pipelines) {
                const rawPipeline = await this.getPipelineDeclarations(client.cpClient, {
                  name: pipeline.name,
                });
                if (rawPipeline) {
                  const newPipeline = await this.pipelineDeclarationMapper(rawPipeline, ctx, region);
                  if (newPipeline) out.push(newPipeline);
                }
              }
            }
          }),
        );
        return out;
      }
    },
    update: async (pds: PipelineDeclaration[], ctx: Context) => {
      const out = [];
      for (const pd of pds) {
        const cloudRecord = ctx?.memo?.cloud?.PipelineDeclaration?.[this.entityId(pd)];
        // we cannot allow to update a pipeline because we cannot reuse oauth or any secrets
        pd.serviceRole = cloudRecord.serviceRole;
        await this.module.pipelineDeclaration.db.update(pd, ctx);
        out.push(pd);
      }
      return out;
    },
    delete: async (pds: PipelineDeclaration[], ctx: Context) => {
      for (const pd of pds) {
        const client = (await ctx.getAwsClient(pd.region)) as AWS;

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
