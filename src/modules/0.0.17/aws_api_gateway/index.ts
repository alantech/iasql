import {
    APIGateway,
    CreateRestApiCommandInput,
    PatchOperation,
    RestApi as RestApiAWS,
    UpdateRestApiCommandInput,
  } from '@aws-sdk/client-api-gateway'

  import { AWS, crudBuilder2, crudBuilderFormat, } from '../../../services/aws_macros'
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
    getRestApis = crudBuilderFormat<APIGateway, 'getRestApis', RestApiAWS[]>(
      'getRestApis',
      () => ({}),
      (res) => res?.items ?? [],
    );

    async createRestApi(client: APIGateway, input: CreateRestApiCommandInput) {
      console.log("in create");
      console.log(input);
      const newRestApi = await client.createRestApi(input);
      console.log("output");
      console.log(newRestApi);
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
          const input: CreateRestApiCommandInput = {
            name: r.name,
            description: r.description,
            disableExecuteApiEndpoint: r.disableExecuteApiEndpoint,
            policy: r.policy,
            version: r.version
          };
          const result = await this.createRestApi(client.apiGatewayClient, input);
          if (result) {
            console.log("in result");
            console.log(result);
            const newApi = this.restApiMapper(result);
            console.log("new");
            console.log(newApi);
            out.push(newApi);
          }
        }
        return out;
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;

        const allApis = await this.getRestApis(client.apiGatewayClient);
        const out : RestApi[] = [];
        const apis : RestApiAWS[] = allApis
            .filter(r => !id);
        return out;
      },
      updateOrReplace: (a: RestApi, b: RestApi) => 'update',
      update: async (rs: RestApi[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const r of rs) {
          const cloudRecord = ctx?.memo?.cloud?.RestApi?.[r.restApiId ?? ''];
          const isUpdate = Object.is(this.module.restApi.cloud.updateOrReplace(cloudRecord, r), 'update');
          if (isUpdate) {
            // prepare patch operations
            const patches : PatchOperation[] = [];
            const fields = ['description', 'disableExecuteApiEndpoint', 'name', 'policy', 'version'];
            type ObjectKey = keyof typeof r;
            fields.forEach(field => {
                let myVar = field as ObjectKey;
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
                // Save the record back into the database to get the new fields updated
                await this.module.restApi.db.update(newApi, ctx);
                out.push(newApi);
            } else {
                throw new Error("Error updating REST API");
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