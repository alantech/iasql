import isEqual from 'lodash.isequal';

import {
  GraphqlApi as GraphqlApiAWS,
  CreateGraphqlApiCommandInput,
  UpdateGraphqlApiCommandInput,
  AppSync,
} from '@aws-sdk/client-appsync';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { AuthenticationType, GraphqlApi } from './entity';

class GraphqlApiMapper extends MapperBase<GraphqlApi> {
  module: AwsAppsyncModule;
  entity = GraphqlApi;
  equals = (a: GraphqlApi, b: GraphqlApi) =>
    Object.is(a.apiId, b.apiId) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.authenticationType, b.authenticationType) &&
    isEqual(a.lambdaAuthorizerConfig, b.lambdaAuthorizerConfig) &&
    isEqual(a.openIDConnectConfig, b.openIDConnectConfig) &&
    isEqual(a.userPoolConfig, b.userPoolConfig);

  graphqlApiMapper(api: GraphqlApiAWS) {
    const out = new GraphqlApi();
    if (!api.name) return undefined;
    else out.name = api.name;
    if (api.apiId) out.apiId = api.apiId;
    if (api.arn) out.arn = api.arn;
    if (api.authenticationType) {
      const authType = api.authenticationType as keyof typeof AuthenticationType;
      out.authenticationType = AuthenticationType[authType];
    }
    if (api.lambdaAuthorizerConfig) {
      out.lambdaAuthorizerConfig = api.lambdaAuthorizerConfig as GraphqlApi['lambdaAuthorizerConfig'];
    } else out.lambdaAuthorizerConfig = undefined;

    if (api.openIDConnectConfig) {
      out.openIDConnectConfig = api.openIDConnectConfig as GraphqlApi['openIDConnectConfig'];
    } else out.openIDConnectConfig = undefined;

    if (api.userPoolConfig) {
      out.userPoolConfig = api.userPoolConfig as GraphqlApi['userPoolConfig'];
    } else out.userPoolConfig = undefined;

    return out;
  }

  createGraphqlApi = crudBuilder2<AppSync, 'createGraphqlApi'>('createGraphqlApi', input => input);

  getGraphqlApi = crudBuilderFormat<AppSync, 'getGraphqlApi', GraphqlApiAWS | undefined>(
    'getGraphqlApi',
    apiId => apiId,
    res => res?.graphqlApi,
  );

  getGraphqlApis = crudBuilderFormat<AppSync, 'listGraphqlApis', GraphqlApiAWS[]>(
    'listGraphqlApis',
    () => ({}),
    res => res?.graphqlApis ?? [],
  );

  updateGraphqlApi = crudBuilder2<AppSync, 'updateGraphqlApi'>('updateGraphqlApi', input => input);

  deleteGraphqlApi = crudBuilder2<AppSync, 'deleteGraphqlApi'>('deleteGraphqlApi', input => input);

  cloud = new Crud2({
    create: async (apis: GraphqlApi[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const api of apis) {
        const input: CreateGraphqlApiCommandInput = {
          authenticationType: api.authenticationType,
          lambdaAuthorizerConfig: api.lambdaAuthorizerConfig,
          name: api.name,
          openIDConnectConfig: api.openIDConnectConfig,
          userPoolConfig: api.userPoolConfig,
        };

        const res = await this.createGraphqlApi(client.appSyncClient, input);
        if (res && res.graphqlApi) {
          const newApi = this.graphqlApiMapper(res.graphqlApi);
          if (!newApi) continue;
          await this.module.graphqlApi.db.update(newApi, ctx);
          out.push(newApi);
        }
      }
      return out;
    },
    read: async (ctx: Context, apiId?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (apiId) {
        const rawApi = await this.getGraphqlApi(client.appSyncClient, apiId);
        if (!rawApi) return undefined;
        return this.graphqlApiMapper(rawApi);
      } else {
        const rawApis = (await this.getGraphqlApis(client.appSyncClient)) ?? [];
        const out = [];
        for (const i of rawApis) {
          const outApi = this.graphqlApiMapper(i);
          if (outApi) out.push(outApi);
        }
        return out;
      }
    },
    update: async (apis: GraphqlApi[], ctx: Context) => {
      // if user has modified specific values, restore it. If not, go with update path
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const api of apis) {
        const cloudRecord = ctx?.memo?.cloud?.GraphqlApi?.[api.name ?? ''];
        const isUpdate = Object.is(this.module.graphqlApi.cloud.updateOrReplace(cloudRecord, api), 'update');
        if (isUpdate) {
          // in case of key fields being modified, restore them
          if (api.apiId !== cloudRecord.apiId) api.apiId = cloudRecord.apiId;
          if (api.arn !== cloudRecord.arn) api.arn = cloudRecord.arn;

          // need to continue updating
          if (
            api.authenticationType !== cloudRecord.authenticationType ||
            !isEqual(api.lambdaAuthorizerConfig, cloudRecord.lambdaAuthorizerConfig) ||
            !isEqual(api.openIDConnectConfig, cloudRecord.openIDConnectConfig) ||
            !isEqual(api.userPoolConfig, cloudRecord.userPoolConfig)
          ) {
            const input: UpdateGraphqlApiCommandInput = {
              apiId: api.apiId,
              name: api.name,
              authenticationType: api.authenticationType,
              lambdaAuthorizerConfig: api.lambdaAuthorizerConfig,
              openIDConnectConfig: api.openIDConnectConfig,
              userPoolConfig: api.userPoolConfig,
            };
            const res = await this.updateGraphqlApi(client.appSyncClient, input);
            if (res && res.graphqlApi) {
              const newApi = this.graphqlApiMapper(res.graphqlApi);
              if (newApi) {
                newApi.name = api.name;
                // Save the record back into the database to get the new fields updated
                await this.module.graphqlApi.db.update(newApi, ctx);
                out.push(newApi);
              }
            } else {
              throw new Error('Error updating Graphql API');
            }
          } else {
            // we just need simple update
            await this.module.graphqlApi.db.update(api, ctx);
            out.push(api);
          }
        }
      }
      return out;
    },
    delete: async (apis: GraphqlApi[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const api of apis) {
        if (api.apiId) {
          await this.deleteGraphqlApi(client.appSyncClient, {
            apiId: api.apiId,
          });
        }
      }
    },
  });
  constructor(module: AwsAppsyncModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsAppsyncModule extends ModuleBase {
  graphqlApi: GraphqlApiMapper;

  constructor() {
    super();
    this.graphqlApi = new GraphqlApiMapper(this);
    super.init();
  }
}
export const awsAppsyncModule = new AwsAppsyncModule();
