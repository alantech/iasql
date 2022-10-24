import {
  CodeBuild,
  SourceCredentialsInfo,
  ImportSourceCredentialsInput,
  DeleteSourceCredentialsCommandInput,
} from '@aws-sdk/client-codebuild';

import { AwsCodebuildModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { SourceCredentialsList, SourceCredentialsImport, SourceType, AuthType } from '../entity';

export class SourceCredentialsListMapper extends MapperBase<SourceCredentialsList> {
  module: AwsCodebuildModule;
  entity = SourceCredentialsList;
  equals = (a: SourceCredentialsList, b: SourceCredentialsList) =>
    Object.is(a.arn, b.arn) && Object.is(a.authType, b.authType) && Object.is(a.sourceType, b.sourceType);

  sourceCredentialsListMapper(s: SourceCredentialsInfo, region: string) {
    const out = new SourceCredentialsList();
    if (!s?.arn) return undefined;
    out.arn = s.arn;
    out.sourceType = s.serverType as SourceType;
    out.authType = s.authType as AuthType;
    out.region = region;
    return out;
  }

  listSourceCredentials = crudBuilderFormat<
    CodeBuild,
    'listSourceCredentials',
    SourceCredentialsInfo[] | undefined
  >(
    'listSourceCredentials',
    input => input,
    res => res?.sourceCredentialsInfos,
  );

  deleteSourceCredentials = crudBuilder2<CodeBuild, 'deleteSourceCredentials'>(
    'deleteSourceCredentials',
    input => input,
  );

  cloud: Crud2<SourceCredentialsList> = new Crud2({
    create: async (es: SourceCredentialsList[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.sourceCredentialsList.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { region, arn } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const scs = await this.listSourceCredentials(client.cbClient);
          if (!scs) return;
          const res = scs?.filter(c => arn === c.arn);
          if (!res || res.length !== 1) return;
          return this.sourceCredentialsListMapper(res[0], region);
        }
      } else {
        const out: SourceCredentialsList[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const scs = await this.listSourceCredentials(client.cbClient);
            if (!scs) return;
            for (const sc of scs) {
              const outSc = this.sourceCredentialsListMapper(sc, region);
              if (outSc) out.push(outSc);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: SourceCredentialsList[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.SourceCredentialsList?.[this.entityId(e)];
        await this.module.sourceCredentialsList.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (scs: SourceCredentialsList[], ctx: Context) => {
      for (const sc of scs) {
        const client = (await ctx.getAwsClient(sc.region)) as AWS;
        const input: DeleteSourceCredentialsCommandInput = {
          arn: sc.arn,
        };
        await this.deleteSourceCredentials(client.cbClient, input);
      }
    },
  });

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}

export class SourceCredentialsImportMapper extends MapperBase<SourceCredentialsImport> {
  module: AwsCodebuildModule;
  entity = SourceCredentialsImport;
  entityId = (e: SourceCredentialsImport) => e.id.toString();
  equals = (a: SourceCredentialsImport, b: SourceCredentialsImport) =>
    Object.is(a.authType, b.authType) &&
    Object.is(a.id, b.id) &&
    Object.is(a.sourceType, b.sourceType) &&
    Object.is(a.token, b.token) &&
    Object.is(a.region, b.region);

  importSourceCredentials = crudBuilderFormat<CodeBuild, 'importSourceCredentials', string | undefined>(
    'importSourceCredentials',
    input => input,
    res => res?.arn,
  );

  db = new Crud2<SourceCredentialsImport>({
    create: (es: SourceCredentialsImport[], ctx: Context) => ctx.orm.save(SourceCredentialsImport, es),
    update: (es: SourceCredentialsImport[], ctx: Context) => ctx.orm.save(SourceCredentialsImport, es),
    delete: (es: SourceCredentialsImport[], ctx: Context) => ctx.orm.remove(SourceCredentialsImport, es),
    read: async (ctx: Context, id?: string) => {
      const opts = id
        ? {
            where: {
              id,
            },
          }
        : {};
      return await ctx.orm.find(SourceCredentialsImport, opts);
    },
  });
  cloud: Crud2<SourceCredentialsImport> = new Crud2({
    create: async (es: SourceCredentialsImport[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: ImportSourceCredentialsInput = {
          token: e.token,
          serverType: e.sourceType,
          authType: e.authType,
        };
        const arn = await this.importSourceCredentials(client.cbClient, input);
        if (!arn) throw new Error('Error importing source credentials');
        const importedCreds = await this.module.sourceCredentialsList.cloud.read(ctx, `${arn}|${e.region}`);
        await this.module.sourceCredentialsImport.db.delete(e, ctx);
        await this.module.sourceCredentialsList.db.create(importedCreds, ctx);
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
