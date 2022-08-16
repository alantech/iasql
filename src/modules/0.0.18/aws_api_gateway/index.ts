import {
    APIGateway,
    CreateRestApiCommandInput,
    paginateGetRestApis,
    PatchOperation,
    RestApi as RestApiAWS,
    UpdateRestApiCommandInput,
  } from '@aws-sdk/client-api-gateway'

  import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
  import { RestApi, } from './entity'
  import { Context, Crud2, MapperBase, ModuleBase, } from '../../interfaces'
  import isEqual from 'lodash.isequal'

  class RestApiMapper extends MapperBase<RestApi> {
    module: AwsApiGatewayModule;
    entity = RestApi;
    equals = (a: RestApi, b: RestApi) => {
      const res = Object.is(a.name, b.name) &&
      Object.is(a.description, b.description) &&
      Object.is(a.disableExecuteApiEndpoint, b.disableExecuteApiEndpoint) &&
      Object.is(a.version, b.version) &&
      isEqual(a.policy, b.policy);
      return res;
    };

    getRestApi = crudBuilder2<APIGateway, 'getRestApi'>(
      'getRestApi',
      (restApiId) => ({ restApiId, }),
    );

    getRestApis = paginateBuilder<APIGateway>(
      paginateGetRestApis,
      "items"
    );

    async createRestApi(client: APIGateway, input: CreateRestApiCommandInput) {
      const newRestApi = await client.createRestApi(input);
      return newRestApi;
    }

    deleteRestApi = crudBuilder2<APIGateway, 'deleteRestApi'>(
    'deleteRestApi',
    (restApiId) => ({ restApiId, }),
    );

    updateRestApi = crudBuilder2<APIGateway, 'updateRestApi'>(
        'updateRestApi',
        (input) => input,
      );

    cloud = new Crud2<RestApi>({
      create: async (rs: RestApi[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const r of rs) {
          // if we have an id already, check if exists
          const input: CreateRestApiCommandInput = {
            name: r.name,
            description: r.description,
            disableExecuteApiEndpoint: r.disableExecuteApiEndpoint,
            version: r.version
          };
          const result = await this.createRestApi(client.apiGatewayClient, input);
          if (result) {
            const newApi = this.restApiMapper(result);
            // use the same ID as the one inserted
            newApi.id = r.id;
            await this.module.restApi.db.update(newApi, ctx);
            out.push(newApi);
          }
        }
        return out;
      },
      read: async (ctx: Context, restApiId?: string) => {
        const client = (await ctx.getAwsClient()) as AWS;
        if (restApiId) {
          const rawApi = await this.getRestApi(
            client.apiGatewayClient,
            restApiId
          );
          if (!rawApi) return undefined;
          return this.restApiMapper(rawApi);
        } else {
          const rawApis =
            (await this.getRestApis(client.apiGatewayClient)) ?? [];
          const out = [];
          for (const i of rawApis) {
            const outApi = this.restApiMapper(i);
            if (outApi) out.push(outApi);
          }
          return out;
        }
      },
      updateOrReplace: (a: RestApi, b: RestApi) => 'update',
      update: async (rs: RestApi[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const r of rs) {
          const cloudRecord = ctx?.memo?.cloud?.RestApi?.[r.restApiId ?? ''];
          const isUpdate = Object.is(this.module.restApi.cloud.updateOrReplace(cloudRecord, r), 'update');
          if (isUpdate) {
            // if restApiId has changed, restore the document
            if (cloudRecord.id !== r.id || cloudRecord.restApiId !== r.restApiId) {
                // restore
                await this.module.restApi.db.update(
                  cloudRecord,
                  ctx
                );
                out.push(cloudRecord);
            } else {
              // prepare patch operations
              const patches : PatchOperation[] = [];
              const fields = ['description', 'disableExecuteApiEndpoint', 'name', 'policy', 'version'];
              type ObjectKey = keyof typeof r;
              fields.forEach(field => {
                  const myVar = field as ObjectKey;
                  if (cloudRecord[field] !== r[myVar]) {
                      // add a replace operation
                      patches.push({op: "replace", "path": "/"+field, value: r[myVar]});
                  }
              });

              const req: UpdateRestApiCommandInput = {
                  restApiId: r.restApiId,
                  patchOperations: patches
              };
              const res = await this.updateRestApi(client.apiGatewayClient, req);
              if (res) {
                  const newApi = this.restApiMapper(res);
                  newApi.restApiId = r.restApiId;
                  newApi.id = r.id;
                  // Save the record back into the database to get the new fields updated
                  await this.module.restApi.db.update(newApi, ctx);
                  out.push(newApi);
              } else {
                  throw new Error("Error updating REST API");
              }
            }
          }
        }
        return out;
      },
      delete: async (rs: RestApi[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const r of rs) {
          await this.deleteRestApi(client.apiGatewayClient, r.restApiId);
        }
      },
    });

    constructor(module: AwsApiGatewayModule) {
      super();
      this.module = module;
      super.init();
    }

    restApiMapper(instance: RestApiAWS) {
      const r: RestApi = new RestApi();
      if (!instance.id) throw new Error('Received an API without a id');
      if (!instance.name) throw new Error('Received an API without a name');
      r.description = instance.description;
      r.disableExecuteApiEndpoint = instance.disableExecuteApiEndpoint;
      r.name = instance.name;
      r.policy = instance.policy;
      r.restApiId = instance.id;
      r.version = instance.version;
      return r;
    }
  }

  class AwsApiGatewayModule extends ModuleBase {
    restApi: RestApiMapper;

    constructor() {
      super();
      this.restApi = new RestApiMapper(this);
      super.init();
    }
  }
  export const awsApiGatewayModule = new AwsApiGatewayModule();