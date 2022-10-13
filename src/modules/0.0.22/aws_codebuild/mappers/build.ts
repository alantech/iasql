import {
  Build,
  CodeBuild,
  BatchDeleteBuildsCommandInput,
  BatchGetBuildsCommandInput,
  StartBuildInput,
  StopBuildInput,
  paginateListBuilds,
} from '@aws-sdk/client-codebuild';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsCodebuildModule } from '..';
import { AWS, paginateBuilder, crudBuilderFormat, crudBuilder2 } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodebuildBuildList, CodebuildBuildImport, BuildStatus } from '../entity';

export class CodebuildBuildListMapper extends MapperBase<CodebuildBuildList> {
  module: AwsCodebuildModule;
  entity = CodebuildBuildList;
  equals = (a: CodebuildBuildList, b: CodebuildBuildList) =>
    Object.is(a.project?.arn, b.project?.arn) &&
    Object.is(a.buildStatus, b.buildStatus) &&
    Object.is(a.startTime?.toISOString(), b.startTime?.toISOString()) &&
    Object.is(a.endTime?.toISOString(), b.endTime?.toISOString());

  async buildListMapper(s: Build, ctx: Context, region: string): Promise<CodebuildBuildList | undefined> {
    const out = new CodebuildBuildList();
    if (!s?.id || !s?.arn) return undefined;
    out.arn = s.arn;
    out.awsId = s.id;
    out.buildStatus = s.buildStatus as BuildStatus;
    if (!Object.values(ctx.memo?.cloud?.CodebuildProject ?? {}).length) {
      out.project =
        (await this.module.project.db.read(ctx, `${s.projectName}|${region}`)) ??
        (await this.module.project.cloud.read(ctx, `${s.projectName}|${region}`));
    } else {
      out.project =
        (await this.module.project.db.read(ctx, `${s.projectName}|${region}`)) ??
        ctx?.memo?.cloud?.CodebuildProject?.[`${s.projectName}|${region}`];
    }
    out.buildNumber = s.buildNumber;
    out.endTime = s.endTime;
    out.startTime = s.startTime;
    out.region = region;
    return out;
  }

  async waitForBuildsToStop(client: CodeBuild, ids: string[]) {
    // wait for policies to be attached
    const input: BatchGetBuildsCommandInput = {
      ids,
    };
    await createWaiter<CodeBuild, BatchGetBuildsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.batchGetBuilds(cmd);
          const done = data?.builds?.every(bd => bd.buildStatus === BuildStatus.STOPPED || !!bd.endTime);
          if (done) {
            return { state: WaiterState.SUCCESS };
          }
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  listBuildIds = paginateBuilder<CodeBuild>(paginateListBuilds, 'ids');

  getBuilds = crudBuilderFormat<CodeBuild, 'batchGetBuilds', Build[] | undefined>(
    'batchGetBuilds',
    input => input,
    res => res?.builds,
  );

  stopBuild = crudBuilder2<CodeBuild, 'stopBuild'>('stopBuild', input => input);

  deleteBuilds = crudBuilder2<CodeBuild, 'batchDeleteBuilds'>('batchDeleteBuilds', input => input);

  cloud: Crud2<CodebuildBuildList> = new Crud2({
    create: async (es: CodebuildBuildList[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.buildList.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      let input: BatchGetBuildsCommandInput;
      let builds: Build[] | undefined;
      if (!!id) {
        const { awsId, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          input = {
            ids: [awsId],
          };
          builds = await this.getBuilds(client.cbClient, input);
          if (!builds || builds.length !== 1) return;
          return this.buildListMapper(builds[0], ctx, region);
        }
      } else {
        const out: CodebuildBuildList[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const ids = await this.listBuildIds(client.cbClient);
            if (!ids || !ids.length) return;
            input = {
              ids,
            };
            builds = await this.getBuilds(client.cbClient, input);
            if (!builds) return;
            for (const build of builds) {
              const outB = await this.buildListMapper(build, ctx, region);
              if (outB) out.push(outB);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: CodebuildBuildList[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.CodebuildBuildList?.[this.entityId(e)];
        await this.module.buildList.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (bds: CodebuildBuildList[], ctx: Context) => {
      const idsToStop: { [key: string]: string[] } = {};
      bds
        .filter(bd => bd.buildStatus === BuildStatus.IN_PROGRESS)
        .forEach(bd =>
          idsToStop[bd.region] ? idsToStop[bd.region].push(bd.awsId) : (idsToStop[bd.region] = [bd.awsId]),
        );
      await Promise.all(
        Object.entries(idsToStop).map(async ([region, ids]) => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          for (const id of ids) {
            const input: StopBuildInput = { id };
            await this.stopBuild(client.cbClient, input);
          }
        }),
      );
      await Promise.all(
        Object.entries(idsToStop).map(async ([region, ids]) => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          return this.waitForBuildsToStop(client.cbClient, ids);
        }),
      );
      const idsToDel: { [key: string]: string[] } = {};
      bds.forEach(bd =>
        idsToDel[bd.region] ? idsToDel[bd.region].push(bd.awsId) : (idsToDel[bd.region] = [bd.awsId]),
      );
      await Promise.all(
        Object.entries(idsToStop).map(async ([region, ids]) => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          // Wait for ~2.5min until builds can be deleted
          let i = 0;
          let idsToRetry: string[];
          do {
            const input: BatchDeleteBuildsCommandInput = { ids };
            const out = await this.deleteBuilds(client.cbClient, input);
            if (out?.buildsNotDeleted?.length === 0) break;
            idsToRetry = out?.buildsNotDeleted?.map(bd => bd.id as string) ?? [];
            await new Promise(r => setTimeout(r, 5000)); // Sleep for 5s
            i++;
          } while (i < 60 || idsToRetry.length > 0);
          if (i === 59) throw new Error('Error deleting builds');
        }),
      );
    },
  });

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}

export class CodebuildBuildImportMapper extends MapperBase<CodebuildBuildImport> {
  module: AwsCodebuildModule;
  entity = CodebuildBuildImport;
  entityId = (e: CodebuildBuildImport) => e.id.toString();
  equals = (a: CodebuildBuildImport, b: CodebuildBuildImport) =>
    Object.is(a.id, b.id) && Object.is(a.project.projectName, b.project.projectName);

  startBuild = crudBuilderFormat<CodeBuild, 'startBuild', Build | undefined>(
    'startBuild',
    input => input,
    res => res?.build,
  );

  cloud: Crud2<CodebuildBuildImport> = new Crud2({
    create: async (es: CodebuildBuildImport[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const input: StartBuildInput = {
          projectName: e.project.projectName,
        };
        const cloudBuild = await this.startBuild(client.cbClient, input);
        if (!cloudBuild) throw new Error('Error starting build');
        const dbBuild = await this.module.buildList.buildListMapper(cloudBuild, ctx, e.region);
        if (!dbBuild) throw new Error('Error starting build');
        await this.module.buildImport.db.delete(e, ctx);
        await this.module.buildList.db.create(dbBuild, ctx);
      }
    },
    read: async () => {
      return;
    },
    update: async () => {
      return;
    },
    delete: async () => {
      return;
    },
  });

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}
