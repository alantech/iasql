import {
  CodeDeploy,
  ApplicationInfo,
  paginateListApplications,
  CreateApplicationCommandInput,
  GetApplicationCommandInput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodedeployApplication, ComputePlatform } from '../entity';

export class CodedeployApplicationMapper extends MapperBase<CodedeployApplication> {
  module: AwsCodedeployModule;
  entity = CodedeployApplication;
  equals = (a: CodedeployApplication, b: CodedeployApplication) =>
    Object.is(a.applicationName, b.applicationName) &&
    Object.is(a.computePlatform, b.computePlatform) &&
    Object.is(a.applicationId, b.applicationId);

  async applicationMapper(app: ApplicationInfo) {
    const out = new CodedeployApplication();
    if (!app.applicationName) return undefined;
    out.applicationName = app.applicationName;
    out.applicationId = app.applicationId;
    out.computePlatform = (app.computePlatform as ComputePlatform) ?? ComputePlatform.Server;
    return out;
  }

  createApplication = crudBuilderFormat<CodeDeploy, 'createApplication', string | undefined>(
    'createApplication',
    input => input,
    res => res?.applicationId,
  );

  getApplication = crudBuilderFormat<CodeDeploy, 'getApplication', ApplicationInfo | undefined>(
    'getApplication',
    input => input,
    res => res?.application,
  );

  listApplications = paginateBuilder<CodeDeploy>(paginateListApplications, 'applications');

  deleteApplication = crudBuilder2<CodeDeploy, 'deleteApplication'>('deleteApplication', input => input);

  cloud: Crud2<CodedeployApplication> = new Crud2({
    create: async (es: CodedeployApplication[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: CreateApplicationCommandInput = {
          applicationName: e.applicationName,
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
    read: async (ctx: Context, name?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (name) {
        const rawApp = await this.getApplication(client.cdClient, { applicationName: name });
        if (!rawApp) return;

        // map to entity
        const app = await this.applicationMapper(rawApp);
        return app;
      } else {
        const out = [];
        const appNames = await this.listApplications(client.cdClient);
        if (!appNames || !appNames.length) return;
        for (const name of appNames) {
          const rawApp = await this.getApplication(client.cdClient, { applicationName: name });
          if (!rawApp) continue;

          const app = await this.applicationMapper(rawApp);
          if (app) out.push(app);
        }
        return out;
      }
    },
    updateOrReplace: (a: CodedeployApplication, b: CodedeployApplication) =>
      a.applicationId !== b.applicationId ? 'update' : 'replace',
    update: async (apps: CodedeployApplication[], ctx: Context) => {
      const out = [];
      for (const app of apps) {
        const cloudRecord = ctx?.memo?.cloud?.CodedeployApplication?.[app.applicationName ?? ''];
        if (this.module.application.cloud.updateOrReplace(app, cloudRecord) == 'update') {
          if (app.applicationId !== cloudRecord.applicationId) {
            // restore
            await this.module.application.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // delete app and create new one
          await this.module.application.cloud.delete(app, ctx);
          const appId = await this.module.application.cloud.create(app, ctx);
          if (!appId) continue;

          // retrieve app details
          const createdApp = await this.module.application.cloud.read(ctx, app.applicationName);
          if (createdApp) out.push(createdApp);
        }
      }
      return out;
    },
    delete: async (apps: CodedeployApplication[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const app of apps) {
        await this.deleteApplication(client.cdClient, { applicationName: app.applicationName });
      }
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
