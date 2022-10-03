import isEqual from 'lodash.isequal';

import {
  CodeDeploy,
  RegisterApplicationRevisionCommandInput,
  RevisionInfo,
} from '@aws-sdk/client-codedeploy';

import { AwsCodedeployModule } from '..';
import { AWS, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { CodedeployDeploymentGroup } from '../entity';
import { CodedeployRevision, RevisionType } from '../entity/revision';

export class CodedeployRevisionGroupMapper extends MapperBase<CodedeployRevision> {
  module: AwsCodedeployModule;
  entity = CodedeployRevision;
  equals = (a: CodedeployRevision, b: CodedeployRevision) =>
    Object.is(a.application, b.application) &&
    Object.is(a.description, b.description) &&
    isEqual(a.location, b.location);

  async revisionMapper(revision: RevisionInfo, ctx: Context) {
    const out = new CodedeployRevision();
    if (!revision.genericRevisionInfo?.deploymentGroups) return undefined;

    // get application from deployment groups
    for (const group of revision.genericRevisionInfo.deploymentGroups) {
      // all revisions will be for the same application
      const rawGroup: CodedeployDeploymentGroup =
        (await this.module.deploymentGroup.db.read(ctx, group)) ??
        this.module.deploymentGroup.cloud.read(ctx, group);
      if (rawGroup) {
        out.application = rawGroup.application;
      }
      break;
    }
    out.description = revision.genericRevisionInfo.description;

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

  createRevision = crudBuilderFormat<CodeDeploy, 'registerApplicationRevision', null>(
    'registerApplicationRevision',
    input => input,
    res => null,
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

  cloud: Crud2<CodedeployRevision> = new Crud2({
    create: async (es: CodedeployRevision[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const input: RegisterApplicationRevisionCommandInput = {
          applicationName: e.application.name,
          description: e.description,
          revision: e.location,
        };
        await this.createRevision(client.cdClient, input);

        // we need to update app
        const app =
          (await this.module.application.db.read(ctx, e.application.name)) ??
          this.module.application.cloud.read(ctx, e.application.name);
        if (app) e.application = app;
        await this.db.update(e, ctx);
        out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, applicationName?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];

      if (applicationName) {
        const rawApps = await this.getApplicationRevisions(client.cdClient, {
          applicationName: applicationName,
        });
        if (!rawApps) return;

        // map to entities
        for (const rawApp of rawApps) {
          const app = await this.revisionMapper(rawApp, ctx);
          if (app) out.push(app);
        }
      } else {
        // first need to read all applications
        const apps = await this.module.application.cloud.read(ctx);
        for (const app of apps) {
          if (app && app.name) {
            const rawApps = await this.getApplicationRevisions(client.cdClient, {
              applicationName: app.name,
            });
            if (!rawApps) return;

            // map to entities
            for (const rawApp of rawApps) {
              const app = await this.revisionMapper(rawApp, ctx);
              if (app) out.push(app);
            }
          }
        }
        return out;
      }
    },
    update: async (revisions: CodedeployRevision[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const revision of revisions) {
        if (!revision.application || !revision.location || !revision.id) continue;

        // we will just restore the details
        const cloudRecord = ctx?.memo?.cloud?.CodedeployRevision?.[revision.id ?? ''];
        await this.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (revisions: CodedeployRevision[], ctx: Context) => {
      return;
    },
  });

  constructor(module: AwsCodedeployModule) {
    super();
    this.module = module;
    super.init();
  }
}
