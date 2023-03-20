import {
  ApiGatewayV2,
  Api as ApiAWS,
  CreateApiCommandInput,
  UpdateApiCommandInput,
  TagResourceCommandInput,
  GetApiCommandInput,
  UntagResourceCommandInput,
} from '@aws-sdk/client-apigatewayv2';
import { build as buildArn } from '@aws-sdk/util-arn-parser';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsApiGatewayModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, eqTags } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Api, Protocol } from '../entity';

export class ApiMapper extends MapperBase<Api> {
  module: AwsApiGatewayModule;
  entity = Api;
  equals = (a: Api, b: Api) => {
    const res =
      Object.is(a.description, b.description) &&
      Object.is(a.disableExecuteApiEndpoint, b.disableExecuteApiEndpoint) &&
      Object.is(a.protocolType, b.protocolType) &&
      Object.is(a.version, b.version) &&
      Object.is(a.name, b.name) &&
      eqTags(a.tags, b.tags);
    return res;
  };

  getApi = crudBuilder<ApiGatewayV2, 'getApi'>('getApi', ApiId => ({ ApiId }));

  getApis = crudBuilderFormat<ApiGatewayV2, 'getApis', ApiAWS[] | undefined>(
    'getApis',
    () => ({}),
    res => res?.Items,
  );

  createApi = crudBuilder<ApiGatewayV2, 'createApi'>('createApi', input => input);

  deleteApi = crudBuilder<ApiGatewayV2, 'deleteApi'>('deleteApi', ApiId => ({ ApiId }));

  updateApi = crudBuilder<ApiGatewayV2, 'updateApi'>('updateApi', input => input);

  buildApiArn = (apiId: string, region: string, accountId = '') =>
    buildArn({
      partition: 'aws',
      service: 'apigateway',
      region,
      accountId,
      resource: `/apis/${apiId}`,
    });

  tagResource = crudBuilder<ApiGatewayV2, 'tagResource'>('tagResource', input => input);

  async tagAndWait(client: ApiGatewayV2, input: TagResourceCommandInput, ApiId: string) {
    await this.tagResource(client, input);
    await createWaiter<ApiGatewayV2, GetApiCommandInput>(
      {
        client,
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      { ApiId },
      async cl => {
        try {
          const api = await this.getApi(cl, ApiId);
          if (eqTags(api?.Tags, input.Tags)) return { state: WaiterState.SUCCESS };
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );
  }

  untagResource = crudBuilder<ApiGatewayV2, 'untagResource'>('untagResource', input => input);

  async untagAndWait(client: ApiGatewayV2, input: UntagResourceCommandInput, ApiId: string) {
    await this.untagResource(client, input);
    await createWaiter<ApiGatewayV2, GetApiCommandInput>(
      {
        client,
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      { ApiId },
      async cl => {
        try {
          const api = await this.getApi(cl, ApiId);
          if (input.TagKeys?.every(tk => !Object.keys(api?.Tags ?? {}).find(atk => atk === tk))) {
            return { state: WaiterState.SUCCESS };
          }
          return { state: WaiterState.RETRY };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );
  }

  cloud = new Crud<Api>({
    create: async (rs: Api[], ctx: Context) => {
      const out = [];
      for (const r of rs) {
        const client = (await ctx.getAwsClient(r.region)) as AWS;
        // add a default protocol
        if (!r.protocolType) r.protocolType = Protocol.HTTP;
        // if we have an id already, check if exists
        const input: CreateApiCommandInput = {
          Name: r.name,
          Description: r.description,
          DisableExecuteApiEndpoint: r.disableExecuteApiEndpoint,
          ProtocolType: r.protocolType.toString(),
          Version: r.version,
        };
        const result = await this.createApi(client.apiGatewayClient, input);
        if (!result) continue;
        if (Object.keys(r.tags ?? {}).length) {
          const tags: Record<string, string> = {};
          for (const [k, v] of Object.entries(r.tags ?? {})) {
            tags[k] = v;
          }
          const arn = this.buildApiArn(result.ApiId ?? '', r.region);
          await this.tagAndWait(
            client.apiGatewayClient,
            { ResourceArn: arn, Tags: tags },
            result.ApiId ?? '',
          );
        }
        const newApi: Api = await this.cloud.read(
          ctx,
          this.generateId({ apiId: result?.ApiId ?? '', region: r.region }),
        );
        if (!newApi) continue;
        // use the same ID as the one inserted, and set the name as is optionally returned
        newApi.id = r.id;
        newApi.name = r.name;
        await this.module.api.db.update(newApi, ctx);
        out.push(newApi);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { apiId, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawApi = await this.getApi(client.apiGatewayClient, apiId);
          if (rawApi) {
            return this.apiMapper(rawApi, region);
          }
        }
      } else {
        const out: Api[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawApis = (await this.getApis(client.apiGatewayClient)) ?? [];
            for (const i of rawApis) {
              const outApi = this.apiMapper(i, region);
              if (outApi) out.push(outApi);
            }
          }),
        );
        return out;
      }
    },
    update: async (rs: Api[], ctx: Context) => {
      const out: Api[] = [];
      for (const r of rs) {
        const client = (await ctx.getAwsClient(r.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.Api?.[this.entityId(r)];
        // api id is generated by aws, we cannot modify it
        if (cloudRecord.protocolType !== r.protocolType) {
          // restore
          cloudRecord.id = r.id;
          await this.module.api.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          const input: UpdateApiCommandInput = {
            ApiId: r.apiId,
            Name: r.name,
            Description: r.description,
            DisableExecuteApiEndpoint: r.disableExecuteApiEndpoint,
            Version: r.version,
          };
          const res = await this.updateApi(client.apiGatewayClient, input);
          if (!res) continue;
          if (!eqTags(r.tags, cloudRecord.tags)) {
            const apiArn = this.buildApiArn(r.apiId, r.region);
            await this.untagAndWait(
              client.apiGatewayClient,
              {
                ResourceArn: apiArn,
                TagKeys: Object.keys(cloudRecord.tags ?? {}),
              },
              r.apiId,
            );
            await this.tagAndWait(client.apiGatewayClient, { ResourceArn: apiArn, Tags: r.tags }, r.apiId);
          }
          delete ctx?.memo?.cloud?.Api?.[this.entityId(r)];
          const newApi = await this.cloud.read(ctx, this.entityId(r));
          if (newApi) {
            newApi.name = r.name;
            newApi.id = r.id;
            // we keep tags updated in case they have taken a while to be applied
            newApi.tags = r.tags;
            // Save the record back into the database to get the new fields updated
            await this.module.api.db.update(newApi, ctx);
            out.push(newApi);
          }
        }
      }
      return out;
    },
    delete: async (rs: Api[], ctx: Context) => {
      for (const r of rs) {
        const client = (await ctx.getAwsClient(r.region)) as AWS;
        await this.deleteApi(client.apiGatewayClient, r.apiId);
      }
    },
  });

  constructor(module: AwsApiGatewayModule) {
    super();
    this.module = module;
    super.init();
  }

  apiMapper(instance: any, region: string) {
    const r: Api = new Api();
    if (!instance.ApiId || !instance.Name) return undefined;
    r.description = instance.Description;
    r.disableExecuteApiEndpoint = instance.DisableExecuteApiEndpoint;
    r.name = instance.Name;
    r.apiId = instance.ApiId;
    if (instance.ProtocolType) {
      const typedProtocol = instance.ProtocolType as keyof typeof Protocol;
      r.protocolType = Protocol[typedProtocol];
    }
    r.version = instance.Version;
    r.region = region;
    r.tags = instance.Tags;
    return r;
  }
}
