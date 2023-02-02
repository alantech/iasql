import { EC2 } from '@aws-sdk/client-ec2';
import {
  Cluster as AwsCluster,
  ECS,
  paginateListClusters,
  paginateListTasks,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsEcsFargateModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { Cluster } from '../entity';

export class ClusterMapper extends MapperBase<Cluster> {
  module: AwsEcsFargateModule;
  entity = Cluster;
  equals = (a: Cluster, b: Cluster) =>
    Object.is(a.clusterArn, b.clusterArn) &&
    Object.is(a.clusterName, b.clusterName) &&
    Object.is(a.clusterStatus, b.clusterStatus);

  clusterMapper(c: any, region: string) {
    // TODO: Improve the type here
    const out = new Cluster();
    out.clusterName = c.clusterName ?? 'default';
    out.clusterArn = c.clusterArn ?? null;
    out.clusterStatus = c.status ?? null;
    out.region = region;
    return out;
  }

  createCluster = crudBuilderFormat<ECS, 'createCluster', AwsCluster | undefined>(
    'createCluster',
    input => input,
    res => res?.cluster,
  );
  getCluster = crudBuilderFormat<ECS, 'describeClusters', AwsCluster | undefined>(
    'describeClusters',
    id => ({ clusters: [id] }),
    res => res?.clusters?.[0],
  );
  getClusterArns = paginateBuilder<ECS>(paginateListClusters, 'clusterArns');
  getClustersCore = crudBuilderFormat<ECS, 'describeClusters', AwsCluster[]>(
    'describeClusters',
    input => input,
    res => res?.clusters ?? [],
  );
  getClusters = async (client: ECS) =>
    this.getClustersCore(client, { clusters: await this.getClusterArns(client) });
  deleteClusterCore = crudBuilder2<ECS, 'deleteCluster'>('deleteCluster', input => input);

  async getTasksArns(client: ECS, cluster: string, serviceName?: string) {
    const tasksArns: string[] = [];
    let input: any = {
      cluster,
    };
    if (serviceName) {
      input = { ...input, serviceName };
    }
    const paginator = paginateListTasks(
      {
        client,
        pageSize: 25,
      },
      input,
    );
    for await (const page of paginator) {
      tasksArns.push(...(page.taskArns ?? []));
    }
    return tasksArns;
  }

  async deleteCluster(client: { ecsClient: ECS; ec2client: EC2 }, id: string) {
    const clusterServices = await this.module.service.getServices(client.ecsClient, [id]);
    if (clusterServices.length) {
      for (const s of clusterServices) {
        if (!s.serviceName) continue;
        const serviceTasksArns = await this.getTasksArns(client.ecsClient, id, s.serviceName);
        s.desiredCount = 0;
        await this.module.service.updateService(client.ecsClient, {
          service: s.serviceName,
          cluster: id,
          desiredCount: s.desiredCount,
        });
        return this.module.service.deleteService(client, s.serviceName!, id, serviceTasksArns);
      }
    }
    const tasks = await this.getTasksArns(client.ecsClient, id);
    if (tasks.length) {
      await waitUntilTasksStopped(
        {
          client: client.ecsClient,
          // all in seconds
          maxWaitTime: 300,
          minDelay: 1,
          maxDelay: 4,
        },
        {
          cluster: id,
          tasks,
        },
      );
    }
    await this.deleteClusterCore(client.ecsClient, {
      cluster: id,
    });
  }

  cloud: Crud2<Cluster> = new Crud2({
    create: async (es: Cluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const result = await this.createCluster(client.ecsClient, {
          clusterName: e.clusterName,
        });
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('clusterArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getCluster(client.ecsClient, result.clusterArn!);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = this.clusterMapper(newObject, e.region);
        // Save the record back into the database to get the new fields updated
        newEntity.id = e.id;
        await this.module.cluster.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, arn?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (arn) {
        const region = parseArn(arn).region;
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawCluster = await this.getCluster(client.ecsClient, arn);
          if (!rawCluster) return;
          return this.clusterMapper(rawCluster, region);
        }
      } else {
        const out: Cluster[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawClusters = (await this.getClusters(client.ecsClient)) ?? [];
            for (const cluster of rawClusters) {
              const outCluster = this.clusterMapper(cluster, region);
              if (outCluster) out.push(outCluster);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: Cluster, next: Cluster) => {
      if (!Object.is(prev.clusterName, next.clusterName)) return 'replace';
      return 'update';
    },
    update: async (es: Cluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Cluster?.[this.entityId(e)];
        cloudRecord.id = e.id;
        const isUpdate = this.module.cluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          await this.module.cluster.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id in database will be the same `e` will keep it.
          await this.module.cluster.cloud.delete(cloudRecord, ctx);
          out.push(await this.module.cluster.cloud.create(e, ctx));
        }
      }
      return out;
    },
    delete: async (es: Cluster[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        if (e.clusterStatus === 'INACTIVE' && e.clusterName === 'default') {
          const dbCluster = await this.module.cluster.db.read(ctx, this.entityId(e));
          // Temporarily recreate the default inactive cluster if deleted to avoid infinite loops.
          if (!dbCluster) {
            await this.module.cluster.db.create(e, ctx);
          }
        } else {
          await this.deleteCluster(client, e.clusterName);
        }
      }
    },
  });

  constructor(module: AwsEcsFargateModule) {
    super();
    this.module = module;
    super.init();
  }
}
