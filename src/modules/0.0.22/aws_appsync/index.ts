import isEqual from 'lodash.isequal';

import {
  GraphqlApi as GraphqlApiAWS,
  CreateGraphqlApiCommandInput,
  UpdateGraphqlApiCommandInput,
  AppSync,
} from '@aws-sdk/client-appsync';

import { AWS, crudBuilder2, crudBuilderFormat } from '../../../services/aws_macros';
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

  graphqlApiMapper(api: GraphqlApiAWS, region: string) {
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
    out.region = region;
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
      const out = [];
      for (const api of apis) {
        const client = (await ctx.getAwsClient(api.region)) as AWS;
        const input: CreateGraphqlApiCommandInput = {
          authenticationType: api.authenticationType,
          lambdaAuthorizerConfig: api.lambdaAuthorizerConfig,
          name: api.name,
          openIDConnectConfig: api.openIDConnectConfig,
          userPoolConfig: api.userPoolConfig,
        };

        const res = await this.createGraphqlApi(client.appSyncClient, input);
        if (res && res.graphqlApi) {
          const newApi = this.graphqlApiMapper(res.graphqlApi, api.region);
          if (!newApi) continue;
          newApi.id = api.id;
          await this.module.graphqlApi.db.update(newApi, ctx);
          out.push(newApi);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { name, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawApi = await this.getGraphqlApi(client.appSyncClient, name);
          if (rawApi) return this.graphqlApiMapper(rawApi, region);
        }
      } else {
        const out: GraphqlApi[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawApis = (await this.getGraphqlApis(client.appSyncClient)) ?? [];
            for (const i of rawApis) {
              const outApi = this.graphqlApiMapper(i, region);
              if (outApi) out.push(outApi);
            }
          }),
        );
        return out;
      }
    },
    update: async (apis: GraphqlApi[], ctx: Context) => {
      // if user has modified specific values, restore it. If not, go with update path
      const out: GraphqlApi[] = [];
      for (const api of apis) {
        const client = (await ctx.getAwsClient(api.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.GraphqlApi?.[this.entityId(api)];
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
            const newApi: GraphqlApi | undefined = this.graphqlApiMapper(res.graphqlApi, api.region);
            if (newApi) {
              newApi.name = api.name;
              newApi.id = api.id;
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
      return out;
    },
    delete: async (apis: GraphqlApi[], ctx: Context) => {
      for (const api of apis) {
        if (api.apiId) {
          const client = (await ctx.getAwsClient(api.region)) as AWS;
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
