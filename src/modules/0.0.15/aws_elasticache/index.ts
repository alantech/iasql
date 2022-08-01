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
import { raw } from "express";
import { createWaiter, WaiterState } from "@aws-sdk/util-waiter";
import { ModifyActivityStreamCommandInput } from "@aws-sdk/client-rds";

async function createCacheCluster(
  client: ElastiCache,
  input: CreateCacheClusterCommandInput
) {
  const res = await client.createCacheCluster(input);

  const describeInput: DescribeCacheClustersCommandInput = {
    CacheClusterId: res.CacheCluster?.CacheClusterId,
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
        if (out?.CacheClusterStatus == "creating")
          return { state: WaiterState.RETRY };
        else return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    }
  );
  return out;
}

async function modifyCacheCluster(
  client: ElastiCache,
  input: ModifyCacheClusterCommandInput
) {
  const res = await client.modifyCacheCluster(input);
  if (res) return res.CacheCluster;
  else return undefined;
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
        console.log("in map");
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
        console.log("i map");
        console.log(cluster);
        console.log(out);
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
            console.log("in update or replace");
            console.log(a.clusterId);
            console.log(b.clusterId);
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
                console.log(i);
                out.push(
                  await AwsElastiCacheModule.utils.cacheClusterMapper(i, ctx)
                );
              }
              return out;
            }
          },
          update: async (clusters: CacheCluster[], ctx: Context) => {
            console.log("in update");
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
                // we cannot modify the engine, restore
                if (cluster.engine != cloudRecord.engine) {
                  cluster.engine = cloudRecord.engine;
                  await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                    cluster,
                    ctx
                  );
                  out.push(cluster);
                } else {
                  // update the cluster
                  const input: ModifyCacheClusterCommandInput = {
                    CacheClusterId: cluster.clusterId,
                    CacheNodeType: cluster.nodeType,
                    NumCacheNodes: cluster.numNodes,
                  };
                  const res = await modifyCacheCluster(
                    client.elasticacheClient,
                    input
                  );
                  if (res) {
                    // just update the remaining fields
                    cluster.clusterId = cloudRecord.clusterId;
                    await AwsElastiCacheModule.mappers.cacheCluster.db.update(
                      cluster,
                      ctx
                    );
                    out.push(cluster);
                  }
                }
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
