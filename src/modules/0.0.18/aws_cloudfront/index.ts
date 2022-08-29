import _, { forEach } from 'lodash';
import isEqual from 'lodash.isequal';

import {
  CloudFront,
  DistributionConfig,
  paginateListDistributions,
  waitUntilDistributionDeployed,
  DistributionSummary,
  GetDistributionCommandOutput,
} from '@aws-sdk/client-cloudfront';
import { WaiterOptions } from '@aws-sdk/util-waiter';

import { AWS, crudBuilder2, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { Distribution, viewerProtocolPolicyEnum } from './entity';

class DistributionMapper extends MapperBase<Distribution> {
  module: AwsCloudfrontModule;
  entity = Distribution;
  equals = (a: Distribution, b: Distribution) => {
    // specific origins comparison
    const originsA = Object.fromEntries(a.origins.map(({ Id, DomainName }) => [Id, DomainName]));
    const originsB = Object.fromEntries(b.origins.map(({ Id, DomainName }) => [Id, DomainName]));

    return (
      Object.is(a.callerReference, b.callerReference) &&
      Object.is(a.comment, b.comment) &&
      Object.is(a.enabled, b.enabled) &&
      Object.is(a.isIPV6Enabled, b.isIPV6Enabled) &&
      Object.is(a.webACLId, b.webACLId) &&
      isEqual(a.defaultCacheBehavior, b.defaultCacheBehavior) &&
      isEqual(originsA, originsB) &&
      Object.is(a.eTag, b.eTag) &&
      Object.is(a.status, b.status)
    );
  };

  getDistribution = crudBuilder2<CloudFront, 'getDistribution'>('getDistribution', Id => ({ Id }));

  getDistributionConfig = crudBuilder2<CloudFront, 'getDistributionConfig'>('getDistributionConfig', Id => ({
    Id,
  }));

  async getDistributions(client: CloudFront) {
    const results: DistributionSummary[] = [];
    const paginator = paginateListDistributions({ client, pageSize: 25 }, {});
    for await (const page of paginator) {
      if (page.DistributionList) {
        results.push(...(page.DistributionList.Items ?? []));
      }
    }

    // iterate over all distributions and extract the config
    const out: GetDistributionCommandOutput[] = [];
    for (const item of results) {
      // check the distribution ID and get the config
      if (item.Id) {
        const config = await this.getDistribution(client, item.Id);
        if (config) out.push(config);
      }
    }
    return out;
  }

  createDistribution = crudBuilder2<CloudFront, 'createDistribution'>('createDistribution', input => input);

  updateDistribution = crudBuilder2<CloudFront, 'updateDistribution'>('updateDistribution', input => input);

  deleteDistribution = crudBuilder2<CloudFront, 'deleteDistribution'>(
    'deleteDistribution',
    (Id, IfMatch) => ({ Id, IfMatch }),
  );

  async updateDistributionAndWait(
    client: CloudFront,
    distributionId: string,
    req: DistributionConfig,
    etag: string,
  ) {
    const res = await this.updateDistribution(client, {
      Id: distributionId,
      DistributionConfig: req,
      IfMatch: etag,
    });
    if (!res?.Distribution) return undefined;

    // regularly check for distribution status until is deployed
    let i = 0;
    let rawDistribution: any;
    do {
      await new Promise(r => setTimeout(r, 30000)); // sleep for 30s

      rawDistribution = await this.getDistribution(client, distributionId);
      i++;
    } while (rawDistribution.Distribution.Status !== 'Deployed' && i < 30);
    return res;
  }

  async getDistributionConfigForUpdate(client: CloudFront, e: Distribution) {
    // retrieve current distribution config
    const distributionConfig = await this.getDistributionConfig(client, e.distributionId);
    if (!distributionConfig) throw new Error('Cannot update a distribution without config');

    // merge default cache behaviour settings
    const finalCacheBehavior = distributionConfig.DistributionConfig?.DefaultCacheBehavior!;
    finalCacheBehavior.CachePolicyId = e.defaultCacheBehavior.CachePolicyId;
    finalCacheBehavior.TargetOriginId = e.defaultCacheBehavior.TargetOriginId;
    finalCacheBehavior.ViewerProtocolPolicy = e.defaultCacheBehavior.ViewerProtocolPolicy;

    const req: DistributionConfig = {
      CallerReference: e.callerReference,
      Comment: e.comment,
      DefaultCacheBehavior: finalCacheBehavior,
      Enabled: e.enabled,
      IsIPV6Enabled: e.isIPV6Enabled,
      WebACLId: e.webACLId,
      Origins: { Quantity: e.origins.length, Items: e.origins },
      PriceClass: distributionConfig.DistributionConfig?.PriceClass,
      Aliases: distributionConfig.DistributionConfig?.Aliases,
      Logging: distributionConfig.DistributionConfig?.Logging,
      CacheBehaviors: distributionConfig.DistributionConfig?.CacheBehaviors,
      CustomErrorResponses: distributionConfig.DistributionConfig?.CustomErrorResponses,
      DefaultRootObject: distributionConfig.DistributionConfig?.DefaultRootObject,
      HttpVersion: distributionConfig.DistributionConfig?.HttpVersion,
      OriginGroups: distributionConfig.DistributionConfig?.OriginGroups,
      Restrictions: distributionConfig.DistributionConfig?.Restrictions,
      ViewerCertificate: distributionConfig.DistributionConfig?.ViewerCertificate,
    };

    return req;
  }

  transformDefaultCacheBehavior(cache: any) {
    if (cache.TargetOriginId && cache.ViewerProtocolPolicy) {
      const protocol: viewerProtocolPolicyEnum = cache.ViewerProtocolPolicy as viewerProtocolPolicyEnum;
      const defaultCacheBehavior = {
        TargetOriginId: cache.TargetOriginId,
        ViewerProtocolPolicy: protocol,
        CachePolicyId: cache.CachePolicyId,
      };
      return defaultCacheBehavior;
    }
    return undefined;
  }

  transformOrigins(origins: any[]) {
    const finalOrigins: any[] = [];
    origins?.forEach(origin => {
      finalOrigins.push(origin);
    });
    return finalOrigins;
  }

  distributionMapper(distribution: GetDistributionCommandOutput) {
    const out = new Distribution();
    out.callerReference = distribution.Distribution?.DistributionConfig?.CallerReference;
    out.comment = distribution.Distribution?.DistributionConfig?.Comment;
    out.distributionId = distribution.Distribution?.Id;
    out.enabled = distribution.Distribution?.DistributionConfig?.Enabled;
    out.isIPV6Enabled = distribution.Distribution?.DistributionConfig?.IsIPV6Enabled;
    out.webACLId = distribution.Distribution?.DistributionConfig?.WebACLId;
    out.eTag = distribution.ETag;
    out.status = distribution.Distribution?.Status;

    if (distribution.Distribution?.DistributionConfig?.DefaultCacheBehavior) {
      out.defaultCacheBehavior = this.transformDefaultCacheBehavior(
        distribution.Distribution.DistributionConfig.DefaultCacheBehavior,
      )!;
    }
    if (distribution.Distribution?.DistributionConfig?.Origins?.Items) {
      out.origins = this.transformOrigins(distribution.Distribution.DistributionConfig.Origins.Items)!;
    }
    return out;
  }

  cloud = new Crud2<Distribution>({
    create: async (es: Distribution[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const config: DistributionConfig = {
          CallerReference: e.callerReference,
          Comment: e.comment,
          Enabled: e.enabled,
          IsIPV6Enabled: e.isIPV6Enabled,
          WebACLId: e.webACLId,
          Origins: { Quantity: e.origins.length, Items: e.origins },
          DefaultCacheBehavior: e.defaultCacheBehavior,
        };
        const res = await this.createDistribution(client.cloudfrontClient, {
          DistributionConfig: config,
        });

        if (res) {
          await waitUntilDistributionDeployed(
            {
              client: client.cloudfrontClient,
              // all in seconds
              maxWaitTime: 900,
              minDelay: 1,
              maxDelay: 4,
            } as WaiterOptions<CloudFront>,
            { Id: res.Distribution?.Id },
          );

          if (res && res.Distribution) {
            const newDistribution = this.distributionMapper(res);
            newDistribution.id = e.id;
            newDistribution.status = 'Deployed';

            // overwrite json fields as they can change
            if (res.Distribution?.DistributionConfig?.DefaultCacheBehavior) {
              newDistribution.defaultCacheBehavior = this.transformDefaultCacheBehavior(
                res.Distribution.DistributionConfig.DefaultCacheBehavior,
              )!;
            }
            if (res.Distribution?.DistributionConfig?.Origins?.Items) {
              newDistribution.origins = this.transformOrigins(
                res.Distribution.DistributionConfig.Origins.Items,
              )!;
            }
            await this.module.distribution.db.update(newDistribution, ctx);
            out.push(newDistribution);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawDistribution = await this.getDistribution(client.cloudfrontClient, id);
        if (rawDistribution) {
          const result = this.distributionMapper(rawDistribution);
          return result;
        }
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
        const cloudRecord = ctx?.memo?.cloud?.Distribution?.[e.distributionId ?? ''];
        const isUpdate = Object.is(this.module.distribution.cloud.updateOrReplace(cloudRecord, e), 'update');
        if (isUpdate) {
          // in the case of objects being modified, restore them
          if (!Object.is(e.eTag, cloudRecord.eTag) || !Object.is(e.status, cloudRecord.status)) {
            cloudRecord.id = e.id;
            await this.module.distribution.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            if (!e.eTag) throw new Error('Cannot update a distribution without an etag'); // cannot update without etag
            const req = await this.getDistributionConfigForUpdate(client.cloudfrontClient, e);
            const res = await this.updateDistributionAndWait(
              client.cloudfrontClient,
              e.distributionId!,
              req,
              e.eTag,
            );
            if (res && res.Distribution) {
              const newDistribution = this.distributionMapper(res);
              newDistribution.id = e.id;
              newDistribution.status = 'Deployed';

              // overwrite json fields as they can change
              if (res.Distribution?.DistributionConfig?.DefaultCacheBehavior) {
                newDistribution.defaultCacheBehavior = this.transformDefaultCacheBehavior(
                  res.Distribution.DistributionConfig.DefaultCacheBehavior,
                )!;
              }
              if (res.Distribution?.DistributionConfig?.Origins?.Items) {
                newDistribution.origins = this.transformOrigins(
                  res.Distribution.DistributionConfig.Origins.Items,
                )!;
              }

              await this.module.distribution.db.update(newDistribution, ctx);
              out.push(newDistribution);
            }
          }
        }
      }
      return out;
    },
    delete: async (es: Distribution[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        if (e.status !== 'Deployed') continue; // do not modify until it is deployed
        // retrieve current distribution config
        const distributionConfig = await this.getDistributionConfig(
          client.cloudfrontClient,
          e.distributionId,
        );
        if (!distributionConfig) throw new Error('Cannot update a distribution without config');

        // if state is enabled, need to disable
        if (e.enabled && e.eTag) {
          e.enabled = false;
          const req = await this.getDistributionConfigForUpdate(client.cloudfrontClient, e);

          const res = await this.updateDistributionAndWait(
            client.cloudfrontClient,
            e.distributionId!,
            req,
            e.eTag,
          );
          if (res && res.Distribution) {
            const newDistribution = this.distributionMapper(res);
            newDistribution.id = e.id;
            newDistribution.status = 'Deployed';
            e.eTag = newDistribution.eTag;
          }
        }

        if (e.eTag) {
          // once it is disabled we can delete
          await this.deleteDistribution(client.cloudfrontClient, e.distributionId, e.eTag);
        }
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
