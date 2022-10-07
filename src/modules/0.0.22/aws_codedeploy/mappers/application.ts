import isEqual from 'lodash.isequal';

import {
  CodeDeploy,
  ApplicationInfo,
  paginateListApplications,
  CreateApplicationCommandInput,
  RevisionInfo,
  paginateListApplicationRevisions,
  RegisterApplicationRevisionCommandInput,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodedeployApplication, CodedeployRevision, ComputePlatform, RevisionType } from '../entity';

export class CodedeployApplicationMapper extends MapperBase<CodedeployApplication> {
  module: AwsCodedeployModule;
  entity = CodedeployApplication;
  equals = (a: CodedeployApplication, b: CodedeployApplication) =>
    Object.is(a.name, b.name) &&
    Object.is(a.computePlatform, b.computePlatform) &&
    Object.is(a.id, b.id) &&
    Object.is(a.revisions === undefined, b.revisions === undefined) &&
    Object.is(a.revisions!.length, b.revisions!.length);

  listRevisions = paginateBuilder<CodeDeploy>(
    paginateListApplicationRevisions,
    'revisions',
    undefined,
    undefined,
    applicationName => ({ applicationName }),
  );

  getApplicationRevisions = crudBuilderFormat<
    CodeDeploy,
    'batchGetApplicationRevisions',
    RevisionInfo[] | undefined
  >(
    'batchGetApplicationRevisions',
    input => input,
    res => res?.revisions,
  );

  async applicationMapper(app: ApplicationInfo, ctx: Context) {
    const client = (await ctx.getAwsClient()) as AWS;
    const out = new CodedeployApplication();
    if (!app.applicationName) return undefined;
    out.name = app.applicationName;
    out.id = app.applicationId;
    out.computePlatform = (app.computePlatform as ComputePlatform) ?? ComputePlatform.Server;

    // reconcile revisions
    out.revisions = [];
    const rawRevs = await this.listRevisions(client.cdClient, app.applicationName);

    for (const rawRev of rawRevs) {
      // get details
      const rawDetailedRev = await this.getApplicationRevisions(client.cdClient, {
        applicationName: app.applicationName,
        revisions: [rawRev],
      });
      if (rawDetailedRev && rawDetailedRev.length > 0) {
        const rev = await this.revisionMapper(rawDetailedRev[0]);
        if (rev) out.revisions.push(rev);
      }
    }
    return out;
  }

  async revisionMapper(revision: RevisionInfo) {
    const out = new CodedeployRevision();
    out.description = revision.genericRevisionInfo?.description;

    // get location details
    if (revision.revisionLocation) {
      out.location = {
        githubLocation: revision.revisionLocation.gitHubLocation,
        s3Location: revision.revisionLocation.s3Location,
        revisionType: revision.revisionLocation.revisionType as RevisionType,
      };
    }
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
    res => null,
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
          applicationName: e.name,
          computePlatform: ComputePlatform[e.computePlatform],
        };
        const appId = await this.createApplication(client.cdClient, input);
        if (!appId) continue;

        // we just need to add the id
        e.id = appId;
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
        const app = await this.applicationMapper(rawApp, ctx);
        return app;
      } else {
        const out = [];
        const appNames = await this.listApplications(client.cdClient);
        if (!appNames || !appNames.length) return;
        for (const appName of appNames) {
          const rawApp = await this.getApplication(client.cdClient, { applicationName: appName });
          if (!rawApp) continue;

          const app = await this.applicationMapper(rawApp, ctx);
          if (app) out.push(app);
        }
        return out;
      }
    },
    updateOrReplace: (a: CodedeployApplication, b: CodedeployApplication) =>
      a.id !== b.id || (a.revisions ?? []).length !== (b.revisions ?? []).length ? 'update' : 'replace',
    update: async (apps: CodedeployApplication[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];

      for (const app of apps) {
        const cloudRecord = ctx?.memo?.cloud?.CodedeployApplication?.[app.name ?? ''];
        if (this.module.application.cloud.updateOrReplace(app, cloudRecord) === 'update') {
          if (app.id !== cloudRecord.id) {
            // restore
            await this.module.application.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
            continue;
          }
          // check the number of registers. If the are more, add the latest one on the cloud
          if (app.revisions!.length > cloudRecord.revisions!.length) {
            const diff = app.revisions!.length - cloudRecord.revisions!.length;
            // sort by id decreasing
            const latest = app.revisions?.sort((a: CodedeployRevision, b: CodedeployRevision) =>
              a.id < b.id ? 1 : -1,
            );
            const pickedRevs = latest?.splice(0, diff);

            if (pickedRevs && pickedRevs.length > 0) {
              app.revisions = cloudRecord.revisions;

              for (const rev of pickedRevs) {
                // we will create the new revision
                const input: RegisterApplicationRevisionCommandInput = {
                  applicationName: app.name,
                  description: rev.description,
                  revision: rev.location,
                };
                await this.createRevision(client.cdClient, input);
                app.revisions?.push(rev);
              }

              out.push(app);
            }
          }
        } else {
          // delete app and create new one
          await this.module.application.cloud.delete(app, ctx);
          const appId = await this.module.application.cloud.create(app, ctx);
          if (!appId) continue;

          // retrieve app details
          const createdApp = await this.module.application.cloud.read(ctx, app.name);
          if (createdApp) out.push(createdApp);
        }
      }
      return out;
    },
    delete: async (apps: CodedeployApplication[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const app of apps) {
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
