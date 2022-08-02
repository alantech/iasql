import {
  CacheCluster as CacheClusterAWS,
  CreateCacheClusterCommandInput,
  ElastiCache,
  CreateCacheClusterCommandOutput,
  paginateDescribeCacheClusters,
  DescribeCacheClustersCommandInput,
  ModifyCacheClusterCommandInput,
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
import { createWaiter, WaiterState } from "@aws-sdk/util-waiter";

async function waitForClusterState(
  client: ElastiCache,
  clusterId: string,
  status: string
) {
  const describeInput: DescribeCacheClustersCommandInput = {
    CacheClusterId: clusterId,
  };
  let out;
  await createWaiter<ElastiCache, DescribeCacheClustersCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    describeInput,
    async (cl, cmd) => {
      const data = await cl.describeCacheClusters(cmd);
      try {
        out = data.CacheClusters?.pop();
        // If it is not a final state we retry
        if (out?.CacheClusterStatus == status)
          return { state: WaiterState.RETRY };
        else return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    }
  );
  return out;
}

async function createCacheCluster(
  client: ElastiCache,
  input: CreateCacheClusterCommandInput
) {
  const res = await client.createCacheCluster(input);
  if (res) {
    const out = await waitForClusterState(
      client,
      res.CacheCluster?.CacheClusterId!,
      "creating"
    );
    return out;
  }
  return undefined;
}

async function modifyCacheCluster(
  client: ElastiCache,
  input: ModifyCacheClusterCommandInput
) {
  const res = await client.modifyCacheCluster(input);
  if (res) {
    const out = await waitForClusterState(
      client,
      res.CacheCluster?.CacheClusterId!,
      "modifying"
    );
    return out;
  }
  return undefined;
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
          if (cluster.Engine === Engine.MEMCACHED)
            out.engine = Engine.MEMCACHED;
          else out.engine = Engine.REDIS;
        }
        if (cluster.CacheNodeType) out.nodeType = cluster.CacheNodeType!;
        if (cluster.NumCacheNodes) out.numNodes = cluster.NumCacheNodes;
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
            // TEMPORARY: we do not update because it is taking long time, it is
            // not sustainable
            /*if (Object.is(a.clusterId, b.clusterId)) return "update";
            else return "replace";*/
            return "replace";
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
              const res: CacheClusterAWS | undefined = await createCacheCluster(
                client.elasticacheClient,
                input
              );
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
            if (clusterId) {
              const rawCluster = await getCacheCluster(
                client.elasticacheClient,
                clusterId
              );
              if (rawCluster?.CacheClusterStatus == "deleting")
                return undefined;

              return AwsElastiCacheModule.utils.cacheClusterMapper(
                rawCluster,
                ctx
              );
            } else {
              const rawClusters =
                (await getCacheClusters(client.elasticacheClient)) ?? [];
              const out = [];
              for (const i of rawClusters) {
                if (i.CacheClusterStatus == "deleting") continue;
                out.push(
                  await AwsElastiCacheModule.utils.cacheClusterMapper(i, ctx)
                );
              }
              return out;
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
                // we cannot modify the engine, restore
                if (cluster.engine != cloudRecord.engine) {
                  cluster.engine = cloudRecord.engine;
                  await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                    cluster,
                    ctx
                  );
                  out.push(cluster);
                } else {
                  // we recreate, first delete the cluster
                  await deleteCacheCluster(client.elasticacheClient, {
                    CacheClusterId: cluster.clusterId,
                  });

                  // wait for it to be deleted
                  await waitForClusterState(
                    client.elasticacheClient,
                    cluster.clusterId,
                    "deleting"
                  );

                  const input: CreateCacheClusterCommandInput = {
                    CacheClusterId: cluster.clusterId,
                    Engine: cluster.engine,
                    CacheNodeType: cluster.nodeType,
                    NumCacheNodes: cluster.numNodes,
                  };
                  const res: CacheClusterAWS | undefined =
                    await createCacheCluster(client.elasticacheClient, input);
                  if (res) {
                    const newCluster: CacheCluster =
                      await AwsElastiCacheModule.utils.cacheClusterMapper(
                        res,
                        ctx
                      );
                    newCluster.clusterId = cluster.clusterId;
                    await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                      newCluster,
                      ctx
                    );
                    out.push(newCluster);
                  }
                }
              }
            }
            return out;
          },
          delete: async (clusters: CacheCluster[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const cluster of clusters) {
              if (cluster.clusterId) {
                await deleteCacheCluster(client.elasticacheClient, {
                  CacheClusterId: cluster.clusterId,
                });
              }
            }
          },
        }),
      }),
    },
  },
  __dirname
);
