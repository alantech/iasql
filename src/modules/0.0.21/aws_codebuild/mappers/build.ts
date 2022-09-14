import {
  Build,
  CodeBuild,
  BatchDeleteBuildsCommandInput,
  BatchGetBuildsCommandInput,
  StartBuildInput,
  StopBuildInput,
  paginateListBuilds,
} from '@aws-sdk/client-codebuild';

import { AwsCodebuildModule } from '..';
import { AWS, paginateBuilder, crudBuilderFormat, crudBuilder2 } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodebuildBuildList, CodebuildBuildImport, BuildStatus } from '../entity';

export class CodebuildBuildListMapper extends MapperBase<CodebuildBuildList> {
  module: AwsCodebuildModule;
  entity = CodebuildBuildList;
  equals = (a: CodebuildBuildList, b: CodebuildBuildList) =>
    Object.is(a.arn, b.arn) && Object.is(a.id, b.id) && Object.is(a.buildNumber, b.buildNumber) &&
    Object.is(a.project?.arn, b.project?.arn) && Object.is(a.buildStatus, b.buildStatus) &&
    Object.is(a.startTime, b.startTime) && Object.is(a.endTime, b.endTime);

  async buildListMapper(s: Build, ctx: Context) {
    const out = new CodebuildBuildList();
    if (!s?.arn) return undefined;
    out.arn = s.arn;
    out.id = s.id as string;
    out.buildStatus = s.buildStatus as BuildStatus;
    if (!Object.values(ctx.memo?.cloud?.CodebuildProject ?? {}).length) {
      out.project =
        (await this.module.project.db.read(ctx, s.projectName)) ??
        (await this.module.project.cloud.read(ctx, s.projectName));
    } else {
      out.project =
        (await this.module.project.db.read(ctx, s.projectName)) ?? ctx?.memo?.cloud?.CodebuildProject?.[s.projectName ?? ''];
    }
    out.buildNumber = s.buildNumber;
    out.endTime = s.endTime;
    out.startTime = s.startTime;
    return out;
  }

  listBuildIds = paginateBuilder<CodeBuild>(paginateListBuilds, 'ids');

  getBuilds = crudBuilderFormat<CodeBuild, 'batchGetBuilds', Build[] | undefined>(
    'batchGetBuilds',
    input => input,
    res => res?.builds
  );

  stopBuild = crudBuilder2<CodeBuild, 'stopBuild'>(
    'stopBuild',
    input => input,
  );

  deleteBuilds = crudBuilder2<CodeBuild, 'batchDeleteBuilds'>(
    'batchDeleteBuilds',
    input => input,
  );

  cloud: Crud2<CodebuildBuildList> = new Crud2({
    create: async (es: CodebuildBuildList[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.buildList.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const input: BatchGetBuildsCommandInput = {
          ids: [id]
        };
        const builds = await this.getBuilds(client.cbClient, input);
        if (!builds || builds.length !== 1) return;
        return this.buildListMapper(builds[0], ctx);
      }
      const ids = await this.listBuildIds(client.cbClient);
      if (!ids || !ids.length) return;
      const input: BatchGetBuildsCommandInput = {
        ids
      };
      const builds = await this.getBuilds(client.cbClient, input);
      if (!builds) return;
      const out = [];
      for (const build of builds) {
        const outB = await this.buildListMapper(build, ctx);
        if (outB) out.push(outB);
      }
      return out;
    },
    updateOrReplace: () => 'update',
    update: async (es: CodebuildBuildList[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.CodebuildBuildList?.[e.arn ?? ''];
        await this.module.buildList.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (bds: CodebuildBuildList[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const id of bds.filter(bd => bd.buildStatus === BuildStatus.IN_PROGRESS).map(bd => bd.id)) {
        const input: StopBuildInput = { id };
        await this.stopBuild(client.cbClient, input);
      }
      const input: BatchDeleteBuildsCommandInput = { ids: bds.map(bd => bd.id) };
      await this.deleteBuilds(client.cbClient, input);
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
    Object.is(a.id, b.id) &&
    Object.is(a.project.projectName, b.project.projectName);

  startBuild = crudBuilderFormat<CodeBuild, 'startBuild', Build | undefined>(
    'startBuild',
    input => input,
    res => res?.build
  );

  db = new Crud2<CodebuildBuildImport>({
    create: (es: CodebuildBuildImport[], ctx: Context) => ctx.orm.save(CodebuildBuildImport, es),
    update: (es: CodebuildBuildImport[], ctx: Context) => ctx.orm.save(CodebuildBuildImport, es),
    delete: (es: CodebuildBuildImport[], ctx: Context) => ctx.orm.remove(CodebuildBuildImport, es),
    read: async (ctx: Context, id?: string) => {
      const opts = id
        ? {
            where: {
              id,
            },
          }
        : {};
      return await ctx.orm.find(CodebuildBuildImport, opts);
    },
  });
  cloud: Crud2<CodebuildBuildImport> = new Crud2({
    create: async (es: CodebuildBuildImport[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const input: StartBuildInput = {
          projectName: e.project.projectName,
        };
        const build = await this.startBuild(client.cbClient, input);
        if (!build || !build.arn) throw new Error('Error starting build');
        const cloudBuild = await this.module.buildList.cloud.read(ctx, build.arn);
        await this.module.buildImport.db.delete(e, ctx);
        await this.module.buildList.db.create(cloudBuild, ctx);
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
