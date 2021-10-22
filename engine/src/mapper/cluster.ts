import { Cluster as ClusterAWS, CreateClusterCommandInput, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { Cluster, } from '../entity/cluster'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { inspect } from 'util'

export const ClusterMapper = new EntityMapper(Cluster, {
  name: (c: ClusterAWS) => c.clusterName ?? 'default',
  arn: (c: ClusterAWS) => c.clusterArn ?? null,
  status: (c: ClusterAWS) => c.status ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const clusters = (await awsClient.getClusters()) ?? [];
    indexes.setAll(Cluster, clusters, 'clusterName');
    const t2 = Date.now();
    console.log(`Clusters set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: Cluster, awsClient: AWS, indexes: IndexedAWS) => {
    const input: CreateClusterCommandInput = {
      clusterName: obj.name,
    };
    const result = await awsClient.createCluster(input);
    if (!result?.hasOwnProperty('clusterName')) { // Failure
      throw new Error('what should we do here?');
    }
    const newCluster = await awsClient.getCluster(result?.clusterName ?? '');
    indexes.set(Cluster, newCluster?.clusterName ?? '', newCluster);
    const newEntity: Cluster = await ClusterMapper.fromAWS(newCluster, awsClient, indexes);
    newEntity.id = obj.id;
    for (const key of Object.keys(newEntity)) {
      EntityMapper.keepId((obj as any)[key], (newEntity as any)[key]);
      (obj as any)[key] = (newEntity as any)[key];
    }
    return newEntity;
  },
  updateAWS: async (obj: Cluster, awsClient: AWS, indexes: IndexedAWS) => {
    const delObj = await ClusterMapper.deleteAWS(obj, awsClient, indexes);
    await ClusterMapper.createAWS(delObj, awsClient, indexes);
  },
  deleteAWS: async (obj: Cluster, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.deleteCluster(obj.name);
    indexes.del(Cluster, obj.name);
    return obj;
  },
})
