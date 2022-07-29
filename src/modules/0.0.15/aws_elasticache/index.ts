import {
  CacheCluster as CacheClusterAWS,
  CreateCacheClusterCommandInput,
  ElastiCache,
  CreateCacheClusterCommandOutput,
  paginateDescribeCacheClusters,
} from "@aws-sdk/client-elasticache";
import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from "../../../services/aws_macros";
import { CacheCluster, Engine } from "./entity";
import { Context, Crud2, Mapper2, Module2 } from "../../interfaces";
import * as metadata from "./module.json";

async function createCacheCluster(
  client: ElastiCache,
  input: CreateCacheClusterCommandInput
) {
  const res = await client.createCacheCluster(input);
  return res;
}

const getCacheCluster = crudBuilderFormat<
  ElastiCache,
  "describeCacheClusters",
  CacheClusterAWS | undefined
>(
  "describeCacheClusters",
  (id) => ({ CacheClusterId: id }),
  (res) => res?.CacheClusters?.[0]
);
const getCacheClusters = paginateBuilder<ElastiCache>(
  paginateDescribeCacheClusters,
  "CacheClusters"
);
const deleteCacheCluster = crudBuilder2<ElastiCache, "deleteCacheCluster">(
  "deleteCacheCluster",
  (input) => input
);

export const AwsElastiCacheModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      cacheClusterMapper: async (cluster: CacheClusterAWS, ctx: Context) => {
        const client = (await ctx.getAwsClient()) as AWS;
        const out = new CacheCluster();
        if (!cluster.CacheClusterId) return undefined;
        out.clusterId = cluster.CacheClusterId;
        if (cluster.Engine) {
          if (cluster.Engine == Engine.MEMCACHED) out.engine = Engine.MEMCACHED;
          else out.engine = Engine.REDIS;
        }
        if (out.nodeType) out.nodeType = cluster.CacheNodeType!;
        if (out.numNodes) out.numNodes = cluster.NumCacheNodes;
        return out;
      },
    },
    mappers: {
      cacheCluster: new Mapper2<CacheCluster>({
        entity: CacheCluster,
        equals: (a: CacheCluster, b: CacheCluster) =>
          Object.is(a.engine, b.engine) &&
          Object.is(a.nodeType, b.nodeType) &&
          Object.is(a.numNodes, b.numNodes),
        source: "db",
        cloud: new Crud2({
          updateOrReplace: (a: CacheCluster, b: CacheCluster) => {
            if (Object.is(a.clusterId, b.clusterId)) return "update";
            else return "replace";
          },
          create: async (clusters: CacheCluster[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const cluster of clusters) {
              const input: CreateCacheClusterCommandInput = {
                CacheClusterId: cluster.clusterId,
                Engine: cluster.engine,
                CacheNodeType: cluster.nodeType,
                NumCacheNodes: cluster.numNodes,
              };
              const res: CreateCacheClusterCommandOutput =
                await createCacheCluster(client.elasticacheClient, input);
              if (res) {
                const newCluster: CacheCluster =
                  await AwsElastiCacheModule.utils.cacheClusterMapper(res, ctx);
                newCluster.clusterId = cluster.clusterId;
                await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                  newCluster,
                  ctx
                );
                out.push(newCluster);
              }
            }
            return out;
          },
          read: async (ctx: Context, clusterId?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (!!clusterId) {
              const rawCluster = await getCacheCluster(
                client.elasticacheClient,
                clusterId
              );
              if (!rawCluster) return;
              return AwsElastiCacheModule.utils.cacheClusterMapper(rawCluster);
            } else {
              return (await getCacheClusters(client.elasticacheClient)).map(
                (cluster) =>
                  AwsElastiCacheModule.utils.cacheClusterMapper(cluster)
              );
            }
          },
          update: async (clusters: CacheCluster[], ctx: Context) => {
            // if user has modified state, restore it. If not, go with replace path
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const cluster of clusters) {
              const cloudRecord =
                ctx?.memo?.cloud?.CacheCluster?.[cluster.clusterId ?? ""];
              const isUpdate = Object.is(
                AwsElastiCacheModule.mappers.cacheCluster.cloud.updateOrReplace(
                  cloudRecord,
                  cluster
                ),
                "update"
              );
              if (!isUpdate) {
                // we recreate
                const newCluster =
                  await AwsElastiCacheModule.mappers.cacheCluster.cloud.create(
                    cluster,
                    ctx
                  );
                out.push(newCluster);
              } else {
                // just update the remaining fields
                cloudRecord.clusterId = cluster.clusterId;
                await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                  cloudRecord,
                  ctx
                );
                out.push(cloudRecord);
              }
            }
            return out;
          },
          delete: async (clusters: CacheCluster[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const cluster of clusters) {
              await deleteCacheCluster(
                client.elasticacheClient,
                cluster.clusterId ?? ""
              );
            }
          },
        }),
      }),
    },
  },
  __dirname
);
