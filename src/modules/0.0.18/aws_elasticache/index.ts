import {
  CacheCluster as CacheClusterAWS,
  CreateCacheClusterCommandInput,
  DescribeCacheClustersCommandInput,
  ElastiCache,
  paginateDescribeCacheClusters,
} from "@aws-sdk/client-elasticache"
import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from "../../../services/aws_macros"
import { CacheCluster, Engine } from "./entity"
import { Context, Crud2, MapperBase, ModuleBase, } from "../../interfaces"
import { createWaiter, WaiterState } from "@aws-sdk/util-waiter"

class CacheClusterMapper extends MapperBase<CacheCluster> {
  module: AwsElastiCacheModule;
  entity = CacheCluster;
  equals = (a: CacheCluster, b: CacheCluster) =>
    Object.is(a.engine, b.engine) &&
    Object.is(a.nodeType, b.nodeType) &&
    Object.is(a.numNodes, b.numNodes);

  cacheClusterMapper(cluster: CacheClusterAWS) {
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
  }

  async waitForClusterState(
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
          if (out?.CacheClusterStatus === status)
            return { state: WaiterState.RETRY };
          else return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      }
    );
    return out;
  }

  async createCacheCluster(
    client: ElastiCache,
    input: CreateCacheClusterCommandInput
  ) {
    const res = await client.createCacheCluster(input);
    if (res) {
      const out = await this.waitForClusterState(
        client,
        res.CacheCluster?.CacheClusterId!,
        "creating"
      );
      return out;
    }
    return undefined;
  }

  getCacheCluster = crudBuilderFormat<
    ElastiCache,
    "describeCacheClusters",
    CacheClusterAWS | undefined
  >(
    "describeCacheClusters",
    (id) => ({ CacheClusterId: id }),
    (res) => res?.CacheClusters?.[0]
  );
  getCacheClusters = paginateBuilder<ElastiCache>(
    paginateDescribeCacheClusters,
    "CacheClusters"
  );
  deleteCacheCluster = crudBuilder2<ElastiCache, "deleteCacheCluster">(
    "deleteCacheCluster",
    (input) => input
  );

  cloud = new Crud2({
    updateOrReplace: (_a: CacheCluster, _b: CacheCluster) => {
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
        const res: CacheClusterAWS | undefined = await this.createCacheCluster(
          client.elasticacheClient,
          input
        );
        if (res) {
          const newCluster = this.cacheClusterMapper(res);
          if (!newCluster) continue;
          newCluster.clusterId = cluster.clusterId;
          await this.module.cacheCluster.db.update(
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
        const rawCluster = await this.getCacheCluster(
          client.elasticacheClient,
          clusterId
        );
        if (!rawCluster) return undefined;
        if (rawCluster?.CacheClusterStatus === "deleting")
          return undefined;

        return this.cacheClusterMapper(rawCluster);
      } else {
        const rawClusters =
          (await this.getCacheClusters(client.elasticacheClient)) ?? [];
        const out = [];
        for (const i of rawClusters) {
          if (i.CacheClusterStatus === "deleting") continue;
          const outCacheCluster = this.cacheClusterMapper(i);
          if (outCacheCluster) out.push(outCacheCluster);
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
          this.module.cacheCluster.cloud.updateOrReplace(cloudRecord, cluster),
          'update'
        );
        if (!isUpdate) {
          // we cannot modify the engine, restore
          if (cluster.engine !== cloudRecord.engine) {
            cluster.engine = cloudRecord.engine;
            await this.module.cacheCluster.db.update(
              cluster,
              ctx
            );
            out.push(cluster);
          } else {
            // first delete the cluster
            await this.deleteCacheCluster(client.elasticacheClient, {
              CacheClusterId: cluster.clusterId,
            });

            // wait for it to be deleted
            await this.waitForClusterState(
              client.elasticacheClient,
              cluster.clusterId,
              "deleting"
            );

            // now we can create with new id
            const input: CreateCacheClusterCommandInput = {
              CacheClusterId: cluster.clusterId,
              Engine: cluster.engine,
              CacheNodeType: cluster.nodeType,
              NumCacheNodes: cluster.numNodes,
            };
            const res: CacheClusterAWS | undefined =
              await this.createCacheCluster(client.elasticacheClient, input);
            if (res) {
              const newCluster = this.cacheClusterMapper(res);
              if (!newCluster) continue;
              newCluster.clusterId = cluster.clusterId;
              await this.module.cacheCluster.db.update(newCluster, ctx);
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
          await this.deleteCacheCluster(client.elasticacheClient, {
            CacheClusterId: cluster.clusterId,
          });
        }
      }
    },
  });
  constructor(module: AwsElastiCacheModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsElastiCacheModule extends ModuleBase {
  cacheCluster: CacheClusterMapper;

  constructor() {
    super();
    this.cacheCluster = new CacheClusterMapper(this);
    super.init();
  }
}
export const awsElastiCacheModule = new AwsElastiCacheModule();
