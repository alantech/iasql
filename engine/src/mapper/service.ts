import { Service as ServiceAWS, CreateServiceCommandInput, UpdateServiceCommandInput, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { Service, } from '../entity/service'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { AwsVpcConf, Cluster, TaskDefinition } from '../entity'
import { AwsVpcConfMapper, ClusterMapper, ServiceLoadBalancerMapper, TaskDefinitionMapper } from '.'
import { DepError } from '../services/lazy-dep'

export const ServiceMapper = new EntityMapper(Service, {
  name: (s: ServiceAWS) => s.serviceName,
  arn: (s: ServiceAWS) => s.serviceArn ?? null,
  status: (s: ServiceAWS) => s.status ?? null,
  cluster: async (s: ServiceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (s?.clusterArn) {
      const cluster = await awsClient.getCluster(s.clusterArn);
      if (!cluster) return null;
      const entity = await indexes.getOr(Cluster, cluster.clusterName!, awsClient.getCluster.bind(awsClient))
      return await ClusterMapper.fromAWS(entity, awsClient, indexes);
    } else {
      return null;
    }
  },
  task: async (s: ServiceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (s?.taskDefinition) {
      const entity = await indexes.getOr(TaskDefinition, s.taskDefinition, awsClient.getTaskDefinition.bind(awsClient))
      return await TaskDefinitionMapper.fromAWS(entity, awsClient, indexes);
    } else {
      return null;
    }
  },
  desiredCount: (s: ServiceAWS) => s.desiredCount,
  launchType: (s: ServiceAWS) => s.launchType,
  schedulingStrategy: (s: ServiceAWS) => s.schedulingStrategy,
  network: async (s: ServiceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (s?.networkConfiguration?.awsvpcConfiguration) {
      return await AwsVpcConfMapper.fromAWS(s.networkConfiguration.awsvpcConfiguration, awsClient, indexes);
    } else {
      return null;
    }
  },
  loadBalancers: (s: ServiceAWS, awsClient: AWS, indexes: IndexedAWS) =>
    Promise.all(s?.loadBalancers?.map(lb => ServiceLoadBalancerMapper.fromAWS(lb, awsClient, indexes)) ?? []),
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const clusters = indexes.get(Cluster);
    if (!clusters) throw new DepError('Clusters must be loaded first');
    const clusterNames = Object.keys(clusters);
    const services = (await awsClient.getServices(clusterNames)) ?? [];
    const t2 = Date.now();
    services.map(s =>
      indexes.set(AwsVpcConf, s.serviceName!, s.networkConfiguration?.awsvpcConfiguration));
    console.log(`AwsVpcConf set in ${t2 - t1}ms`);
    indexes.setAll(Service, services, 'serviceName');
    const t3 = Date.now();
    console.log(`Services set in ${t3 - t2}ms`);
  },
  createAWS: async (obj: Service, awsClient: AWS, indexes: IndexedAWS) => {
    const input: CreateServiceCommandInput = {
      serviceName: obj.name,
      taskDefinition: obj.task?.taskDefinitionArn ?? `${obj.task?.family}:${obj.task?.revision}`,
      launchType: obj.launchType,
      cluster: obj.cluster?.name,
      schedulingStrategy: obj.schedulingStrategy,
      desiredCount: obj.desiredCount,
    };
    if (obj.network) {
      input.networkConfiguration = {
        awsvpcConfiguration: {
          subnets: obj.network.subnets.map(s => s.subnetId!),
          securityGroups: obj.network.securityGroups.map(s => s.groupId!),
          assignPublicIp: obj.network.assignPublicIp,
        }
      }
    }
    if (obj.loadBalancers?.length) {
      input.loadBalancers = obj.loadBalancers.map(lb => ({
        targetGroupArn: lb.targetGroup?.targetGroupArn,
        loadBalancerName: lb.elb?.loadBalancerName,
        containerName: lb.containerName,
        containerPort: lb.containerPort
      }));
    }
    const result = await awsClient.createService(input);
    if (!result?.hasOwnProperty('serviceName')) { // Failure
      throw new Error('what should we do here?');
    }
    const newService = await awsClient.getService(result?.serviceName ?? '', result.clusterArn ?? '');
    indexes.set(Service, newService?.serviceName ?? '', newService);
    const newEntity: Service = await ServiceMapper.fromAWS(newService, awsClient, indexes);
    newEntity.id = obj.id;
    for (const key of Object.keys(newEntity)) {
      EntityMapper.keepId((obj as any)[key], (newEntity as any)[key]);
      (obj as any)[key] = (newEntity as any)[key];
    }
    return newEntity;
  },
  updateAWS: async (obj: Service, awsClient: AWS, indexes: IndexedAWS) => {
    const input: UpdateServiceCommandInput = {
      service: obj.name,
      taskDefinition: obj.task?.taskDefinitionArn ?? `${obj.task?.family}:${obj.task?.revision}`,
      cluster: obj.cluster?.name,
      desiredCount: obj.desiredCount,
    };
    const result = await awsClient.updateService(input);
    if (!result?.hasOwnProperty('serviceName')) { // Failure
      throw new Error('what should we do here?');
    }
    const newService = await awsClient.getService(result?.serviceName ?? '', result.clusterArn ?? '');
    indexes.set(Service, newService?.serviceName ?? '', newService);
    const newEntity: Service = await ServiceMapper.fromAWS(newService, awsClient, indexes);
    newEntity.id = obj.id;
    for (const key of Object.keys(newEntity)) {
      EntityMapper.keepId((obj as any)[key], (newEntity as any)[key]);
      (obj as any)[key] = (newEntity as any)[key];
    }
    return newEntity;
  },
  deleteAWS: async (obj: Service, awsClient: AWS, indexes: IndexedAWS) => {
    obj.desiredCount = 0;
    await ServiceMapper.updateAWS(obj, awsClient, indexes);
    await awsClient.deleteService(obj.name, obj.cluster?.name!);
    indexes.del(Service, obj.name);
    return obj;
  },
})
