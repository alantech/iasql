import {
    CloudFront,
    DistributionConfig,
    Distribution as DistributionAWS,
    paginateListDistributions,
    waitUntilDistributionDeployed,
    DistributionSummary,
} from '@aws-sdk/client-cloudfront'

import { AWS, crudBuilder2, paginateBuilder, } from '../../../services/aws_macros'
import { Distribution, viewerProtocolPolicyEnum, } from './entity'
import { Context, Crud2, MapperBase, ModuleBase, } from '../../interfaces'
import { WaiterOptions } from '@aws-sdk/util-waiter'

class DistributionMapper extends MapperBase<Distribution> {
    module: AwsCloudfrontModule;
    entity = Distribution;
    equals = (a: Distribution, b: Distribution) =>
        Object.is(a.callerReference, b.callerReference) && Object.is(a.comment, b.comment) && Object.is(a.enabled, b.enabled) &&
            Object.is(a.isIPV6Enabled, b.isIPV6Enabled) && Object.is(a.webACLId, b.webACLId);

    getDistribution = crudBuilder2<CloudFront, 'getDistribution'>(
      'getDistribution',
      (Id) => ({ Id, }),
    );

    async getDistributions (client: CloudFront) {
      const results:DistributionSummary[] = [];
      const paginator = paginateListDistributions({client, pageSize:25}, {});
      for await (const page of paginator) {
        if (page.DistributionList) {
          results.push(...(page.DistributionList.Items ??[]));
        }
      }

      // iterate over all distributions and extract the config
      const out : DistributionAWS[] = [];
      for await (const item of results) {
        // check the distribution ID and get the config
        if (item.Id) {
          const config = await this.getDistribution(client, item.Id);
          if (config && config.Distribution) {
            out.push(config.Distribution);
          }
        }
      }
      return out;
    }

    createDistribution = crudBuilder2<CloudFront, 'createDistribution'>(
      'createDistribution',
      (input) => input,
    );

    updateDistribution = crudBuilder2<CloudFront, 'updateDistribution'>(
      'updateDistribution',
      (input) => input,
    );

    deleteDistribution = crudBuilder2<CloudFront, 'deleteDistribution'>(
      'deleteDistribution',
      (Id) => ({ Id, }),
    );

    async updateDistributionAndWait(client:CloudFront, distributionId: string, req:DistributionConfig, etag:string) {

      const res = await this.updateDistribution(client, {
        Id: distributionId,
        DistributionConfig: req,
        IfMatch: etag
      });
      if (!res?.Distribution) return undefined;

      // wait for distribution to be deployed
      if (res) {
        await waitUntilDistributionDeployed({
          client,
          // all in seconds
          maxWaitTime: 300,
          minDelay: 1,
          maxDelay: 4,
        } as WaiterOptions<CloudFront>, { Id: res.Distribution?.Id, });

        return res;
      }

    }

    distributionMapper (distribution: DistributionAWS) {
      const out = new Distribution();
      out.callerReference = distribution.DistributionConfig?.CallerReference;
      out.comment = distribution.DistributionConfig?.Comment;
      out.distributionId = distribution.Id;
      out.enabled = distribution.DistributionConfig?.Enabled;
      out.isIPV6Enabled = distribution.DistributionConfig?.IsIPV6Enabled;
      out.webACLId = distribution.DistributionConfig?.WebACLId;
      if (distribution.DistributionConfig?.DefaultCacheBehavior) {
        const cache = distribution.DistributionConfig.DefaultCacheBehavior;
        if (cache.TargetOriginId && cache.ViewerProtocolPolicy) {
          const protocol: viewerProtocolPolicyEnum = cache.ViewerProtocolPolicy as viewerProtocolPolicyEnum;
          out.defaultCacheBehavior = {
            TargetOriginId : cache.TargetOriginId,
            ViewerProtocolPolicy: protocol,
            CachePolicyId: cache.CachePolicyId,
          }
        }
      }
      if (distribution.DistributionConfig?.Origins) {
        const origins: any[] = [];
        distribution.DistributionConfig.Origins.Items?.forEach((origin) => {
          origins.push(origin)
        });
        out.origins = origins;
      }
      return out;
    };

    cloud = new Crud2<Distribution>({
      create: async (es: Distribution[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const e of es) {
          if (e.distributionId) continue; // cannot create a distribution with an already created id
          const config:DistributionConfig = {
            CallerReference: e.callerReference,
            Comment: e.comment,
            Enabled: e.enabled,
            IsIPV6Enabled: e.isIPV6Enabled,
            WebACLId: e.webACLId,
            Origins: { Quantity: e.origins.length, Items: e.origins},
            DefaultCacheBehavior: e.defaultCacheBehavior,
          };
          const res = await this.createDistribution(
            client.cloudfrontClient, {
              DistributionConfig: config
            }
          );

          if (res) {
            await waitUntilDistributionDeployed({
              client: client.cloudfrontClient,
              // all in seconds
              maxWaitTime: 300,
              minDelay: 1,
              maxDelay: 4,
            } as WaiterOptions<CloudFront>, { Id: res.Distribution?.Id, });

            if (res && res.Distribution) {
              const newDistribution = this.distributionMapper(res.Distribution);
              newDistribution.id = e.id;
              newDistribution.eTag = res.ETag;
              newDistribution.location = res.Location;
              await this.module.distribution.db.update(newDistribution, ctx);
            }
          }
        }
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        if (id) {
          const rawDistribution = await this.getDistribution(client.cloudfrontClient, id);
          if (!rawDistribution?.Distribution) return undefined;

          const result = this.distributionMapper(rawDistribution.Distribution);
          return result;
        } else {
          const distributions = await this.getDistributions(client.cloudfrontClient);
          const out = [];
          for (const distribution of distributions) {
            out.push(this.distributionMapper(distribution));
          }
          return out;
        }
      },
      updateOrReplace: () => 'update',
      update: async (es: Distribution[], ctx: Context) => {
        const client = (await ctx.getAwsClient()) as AWS;
        const out = [];
        for (const e of es) {
          const cloudRecord = ctx?.memo?.cloud?.Distribution?.[e.distributionId ?? ""];
          const isUpdate = Object.is(
            this.module.distribution.cloud.updateOrReplace(cloudRecord, e),
            'update'
          );
          if (isUpdate) {
            if (e.distributionId !== cloudRecord.distributionId) {
              // restore it
              await this.module.distribution.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            } else {
              const req: DistributionConfig = {
                CallerReference: e.callerReference,
                Comment: e.comment,
                DefaultCacheBehavior: e.defaultCacheBehavior,
                Enabled: e.enabled,
                IsIPV6Enabled: e.isIPV6Enabled,
                WebACLId: e.webACLId,
                Origins: { Quantity: e.origins.length, Items: e.origins },
              };
              if (e.eTag) {
                const res = await this.updateDistributionAndWait(client.cloudfrontClient, e.distributionId!, req, e.eTag);
                if (res && res.Distribution) {
                    const newDistribution = this.distributionMapper(res.Distribution);
                    newDistribution.id = e.id;
                    newDistribution.eTag = res.ETag;
                    await this.module.distribution.db.update(newDistribution, ctx);
                    out.push(newDistribution);
                }
              }
            }
          }
        }
        return out;
      },
      delete: async (es: Distribution[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          // if state is enabled, need to disable
          if (e.enabled) {
            e.enabled = false;
            const req: DistributionConfig = {
              CallerReference: e.callerReference,
              Comment: e.comment,
              DefaultCacheBehavior: e.defaultCacheBehavior,
              Enabled: e.enabled,
              IsIPV6Enabled: e.isIPV6Enabled,
              WebACLId: e.webACLId,
              Origins: { Quantity: e.origins.length, Items: e.origins },
            };
            if (!e.eTag) continue;  // we cannot update without etag

            const res = await this.updateDistributionAndWait(client.cloudfrontClient, e.distributionId!, req, e.eTag);
            if (res && res.Distribution) {
                const newDistribution = this.distributionMapper(res.Distribution);
                newDistribution.id = e.id;
                newDistribution.eTag = res.ETag;
                await this.module.distribution.db.update(newDistribution, ctx);
            }

          }

          // once it is disabled we can delete
          await this.deleteDistribution(client.cloudfrontClient, e.id);
        }
      },
    });

    constructor(module: AwsCloudfrontModule) {
        super();
        this.module = module;
        super.init();
      }
}

class AwsCloudfrontModule extends ModuleBase {
    distribution: DistributionMapper;

    constructor() {
    super();
    this.distribution = new DistributionMapper(this);
    super.init();
    }
}
export const awsCloudfrontModule = new AwsCloudfrontModule();
