import {
  CodeDeploy,
  ApplicationInfo,
  paginateListApplications,
  CreateApplicationCommandInput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { CodedeployApplication, ComputePlatform } from '../entity';

export class CodedeployApplicationMapper extends MapperBase<CodedeployApplication> {
  module: AwsCodedeployModule;
  entity = CodedeployApplication;
  equals = (a: CodedeployApplication, b: CodedeployApplication) =>
    Object.is(a.name, b.name) &&
    Object.is(a.computePlatform, b.computePlatform) &&
    Object.is(a.applicationId, b.applicationId);

  async applicationMapper(app: ApplicationInfo, region: string) {
    const out = new CodedeployApplication();
    if (!app.applicationName) return undefined;
    out.name = app.applicationName;
    out.applicationId = app.applicationId;
    out.computePlatform = (app.computePlatform as ComputePlatform) ?? ComputePlatform.Server;
    out.region = region;
    return out;
  }

  createApplication = crudBuilderFormat<CodeDeploy, 'createApplication', string | undefined>(
    'createApplication',
    input => input,
    res => res?.applicationId,
  );

  createRevision = crudBuilderFormat<CodeDeploy, 'registerApplicationRevision', null>(
    'registerApplicationRevision',
    input => input,
    _res => null,
  );

  getApplication = crudBuilderFormat<CodeDeploy, 'getApplication', ApplicationInfo | undefined>(
    'getApplication',
    input => input,
    res => res?.application,
  );

  listApplications = paginateBuilder<CodeDeploy>(paginateListApplications, 'applications');

  deleteApplication = crudBuilder<CodeDeploy, 'deleteApplication'>('deleteApplication', input => input);

  cloud: Crud<CodedeployApplication> = new Crud({
    create: async (es: CodedeployApplication[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: CreateApplicationCommandInput = {
          applicationName: e.name,
          computePlatform: ComputePlatform[e.computePlatform],
        };
        const appId = await this.createApplication(client.cdClient, input);
        if (!appId) continue;

        // we just need to add the id
        e.applicationId = appId;
        await this.db.update(e, ctx);

        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { name, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawApp = await this.getApplication(client.cdClient, { applicationName: name });
          if (!rawApp) return;
          // map to entity
          const app = await this.applicationMapper(rawApp, region);
          return app;
        }
      } else {
        const out: CodedeployApplication[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const appNames = await this.listApplications(client.cdClient);
            if (!appNames || !appNames.length) return;
            for (const appName of appNames) {
              const rawApp = await this.getApplication(client.cdClient, { applicationName: appName });
              if (!rawApp) continue;
              const app = await this.applicationMapper(rawApp, region);
              if (app) out.push(app);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (_a: CodedeployApplication, _b: CodedeployApplication) => 'replace',
    update: async (apps: CodedeployApplication[], ctx: Context) => {
      const out = [];

      for (const app of apps) {
        // delete app and create new one
        await this.module.application.cloud.delete(app, ctx);
        const appId = await this.module.application.cloud.create(app, ctx);
        if (!appId) continue;

        // retrieve app details
        const createdApp = await this.module.application.cloud.read(ctx, app.name);
        createdApp.id = app.id;
        if (createdApp) out.push(createdApp);
      }
      return out;
    },
    delete: async (apps: CodedeployApplication[], ctx: Context) => {
      for (const app of apps) {
        const client = (await ctx.getAwsClient(app.region)) as AWS;
        await this.deleteApplication(client.cdClient, { applicationName: app.name });
      }
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
