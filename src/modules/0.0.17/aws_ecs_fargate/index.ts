import {
  Cluster as AwsCluster,
  DescribeServicesCommandInput,
  ECS,
  Service as AwsService,
  TaskDefinition as AwsTaskDefinition,
  paginateListClusters,
  paginateListServices,
  paginateListTaskDefinitions,
  paginateListTasks,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'
import {
  EC2,
  DescribeNetworkInterfacesCommandInput,
} from '@aws-sdk/client-ec2'

import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from '../../../services/aws_macros'
import {
  Cluster,
  ContainerDefinition,
  CpuMemCombination,
  Service,
  TaskDefinition,
} from './entity'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import {
  AwsElbModule,
  AwsSecurityGroupModule,
  AwsVpcModule,
  awsCloudwatchModule,
  awsEcrModule,
  awsIamModule,
} from '..'
import * as metadata from './module.json'
import logger from '../../../services/logger'
import { Subnet } from '../aws_vpc/entity'

const createCluster = crudBuilderFormat<ECS, 'createCluster', AwsCluster | undefined>(
  'createCluster',
  (input) => input,
  (res) => res?.cluster,
);
const getCluster = crudBuilderFormat<ECS, 'describeClusters', AwsCluster | undefined>(
  'describeClusters',
  (id) => ({ clusters: [id], }),
  (res) => res?.clusters?.[0],
);
const getClusterArns = paginateBuilder<ECS>(paginateListClusters, 'clusterArns');
const getClustersCore = crudBuilderFormat<ECS, 'describeClusters', AwsCluster[]>(
  'describeClusters',
  (input) => input,
  (res) => res?.clusters ?? [],
);
const getClusters = async (client: ECS) => getClustersCore(
  client,
  { clusters: await getClusterArns(client), }
);
const deleteClusterCore = crudBuilder2<ECS, 'deleteCluster'>(
  'deleteCluster',
  (input) => input,
);
const updateService = crudBuilderFormat<ECS, 'updateService', AwsService | undefined>(
  'updateService',
  (input) => input,
  (res) => res?.service,
);
const createTaskDefinition = crudBuilderFormat<
  ECS,
  'registerTaskDefinition',
  AwsTaskDefinition | undefined
>(
  'registerTaskDefinition',
  (input) => input,
  (res) => res?.taskDefinition,
);
const getTaskDefinition = crudBuilderFormat<
  ECS,
  'describeTaskDefinition',
  AwsTaskDefinition | undefined
>(
  'describeTaskDefinition',
  (taskDefinition) => ({ taskDefinition, }),
  (res) => res?.taskDefinition,
);
const deleteTaskDefinition = crudBuilder2<ECS, 'deregisterTaskDefinition'>(
  'deregisterTaskDefinition',
  (taskDefinition) => ({ taskDefinition, }),
);
const createService = crudBuilderFormat<ECS, 'createService', AwsService | undefined>(
  'createService',
  (input) => input,
  (res) => res?.service,
);
const getService = crudBuilderFormat<ECS, 'describeServices', AwsService | undefined>(
  'describeServices',
  (id, cluster) => ({ services: [id], cluster, }),
  (res) => res?.services?.[0],
);

// TODO: This a whole lot of tangled business logic baked into these functions. It may make sense to
// decompose them in the future.
async function getServices(client: ECS, clusterIds: string[]) {
  const services = [];
  for (const id of clusterIds) {
    const serviceArns: string[] = [];
    const paginator = paginateListServices({
      client,
    }, {
      cluster: id,
      maxResults: 100,
    });
    for await (const page of paginator) {
      serviceArns.push(...(page.serviceArns ?? []));
    }
    if (serviceArns.length) {
      const batchSize = 10; // Following AWS directions
      if (serviceArns.length > batchSize) {
        for (let i = 0; i < serviceArns.length; i += batchSize) {
          const batch = serviceArns.slice(i, i + batchSize);
          const result = await client.describeServices({
            cluster: id,
            services: batch
          });
          services.push(...(result.services ?? []));
        }
      } else {
        const result = await client.describeServices({
          cluster: id,
          services: serviceArns
        });
        services.push(...(result.services ?? []));
      }
    }
  }
  return services;
}
async function getTasksArns(client: ECS, cluster: string, serviceName?: string) {
  const tasksArns: string[] = [];
  let input: any = {
    cluster
  };
  if (serviceName) {
    input = { ...input, serviceName }
  }
  const paginator = paginateListTasks({
    client,
    pageSize: 25,
  }, input);
  for await (const page of paginator) {
    tasksArns.push(...(page.taskArns ?? []));
  }
  return tasksArns;
}
async function deleteService(client: { ecsClient: ECS, ec2client: EC2, }, name: string, cluster: string, tasksArns: string[]) {
  await client.ecsClient.deleteService({
    service: name,
    cluster,
  });
  // We wait it is completely deleted to avoid issues deleting dependent resources.
  const input: DescribeServicesCommandInput = {
    services: [name],
    cluster,
  };
  await createWaiter<ECS, DescribeServicesCommandInput>(
    {
      client: client.ecsClient,
      // all in seconds
      maxWaitTime: 600,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      const data = await cl.describeServices(cmd);
      if (data.services?.length && data.services[0].status === 'DRAINING') {
        return { state: WaiterState.RETRY };
      } else {
        return { state: WaiterState.SUCCESS };
      }
    },
  );
  try {
    const tasks = await client.ecsClient.describeTasks({tasks: tasksArns, cluster});
    const taskAttachmentIds = tasks.tasks?.map(t => t.attachments?.map(a => a.id)).flat()
    if (taskAttachmentIds?.length) {
      const describeEniCommand: DescribeNetworkInterfacesCommandInput = {
        Filters: [
          {
            Name: 'description',
            Values: taskAttachmentIds?.map(id => `*${id}`)
          }
        ]
      };
      await createWaiter<EC2, DescribeNetworkInterfacesCommandInput>(
        {
          client: client.ec2client,
          // all in seconds
          maxWaitTime: 1200,
          // This operation need bigger delays since it takes time and we do not want to overload AWS API
          minDelay: 30,
          maxDelay: 60,
        },
        describeEniCommand,
        async (cl, cmd) => {
          try {
            const eni = await cl.describeNetworkInterfaces(cmd);
            if (eni.NetworkInterfaces?.length) {
              return { state: WaiterState.RETRY };
            }
            return { state: WaiterState.SUCCESS };
          } catch (e) {
            return { state: WaiterState.RETRY };
          }
        },
      );
    }
  } catch (_) {
    // We should not throw here.
    // This is an extra validation to ensure that the service is fully deleted
    logger.info('Error getting network interfaces for tasks')
  }
}
async function deleteCluster(client: { ecsClient: ECS, ec2client: EC2, }, id: string) {
  const clusterServices = await getServices(client.ecsClient, [id]);
  if (clusterServices.length) {
    for (const s of clusterServices) {
      if (!s.serviceName) continue;
      const serviceTasksArns = await getTasksArns(client.ecsClient, id, s.serviceName);
      s.desiredCount = 0;
      await updateService(client.ecsClient, {
        service: s.serviceName,
        cluster: id,
        desiredCount: s.desiredCount,
      });
      return deleteService(client, s.serviceName!, id, serviceTasksArns);
    }
  }
  const tasks = await getTasksArns(client.ecsClient, id);
  if (tasks.length) {
    await waitUntilTasksStopped({
      client: client.ecsClient,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    }, {
      cluster: id,
      tasks,
    });
  }
  await deleteClusterCore(client.ecsClient, {
    cluster: id,
  });
}
async function getTaskDefinitions(client: ECS) {
  const taskDefinitions: any[] = [];
  const activeTaskDefinitionArns: string[] = [];
  const activePaginator = paginateListTaskDefinitions({
    client,
  }, {
    status: 'ACTIVE',
    maxResults: 100,
  });
  for await (const page of activePaginator) {
    activeTaskDefinitionArns.push(...(page.taskDefinitionArns ?? []));
  }
  // Look for INACTIVE task definitons being used
  const clusters = await getClusters(client) ?? [];
  const services = await getServices(client, clusters.map(c => c.clusterArn!)) ?? [];
  const servicesTasks = services.map(s => s.taskDefinition!) ?? [];
  for (const st of servicesTasks) {
    if (!activeTaskDefinitionArns.includes(st)) {
      taskDefinitions.push(await getTaskDefinition(client, st));
    }
  }
  // Do not run them in parallel to avoid AWS throttling error
  for (const arn of activeTaskDefinitionArns) {
    taskDefinitions.push(await getTaskDefinition(client, arn));
  }
  return {
    taskDefinitions,
  };
}
async function deleteServiceOnly(client: ECS, name: string, cluster: string) {
  await client.deleteService({
    service: name,
    cluster,
  });
  // We wait it is completely deleted to avoid issues deleting dependent resources.
  const input: DescribeServicesCommandInput = {
    services: [name],
    cluster,
  };
  await createWaiter<ECS, DescribeServicesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 600,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      const data = await cl.describeServices(cmd);
      if (data.services?.length && data.services[0].status === 'DRAINING') {
        return { state: WaiterState.RETRY };
      } else {
        return { state: WaiterState.SUCCESS };
      }
    },
  );
}

export const AwsEcsFargateModule: Module2 = new Module2({
  ...metadata,
  utils: {
    clusterMapper: (c: any) => {
      const out = new Cluster();
      out.clusterName = c.clusterName ?? 'default';
      out.clusterArn = c.clusterArn ?? null;
      out.clusterStatus = c.status ?? null;
      return out;
    },
    containerDefinitionMapper: async (c: any, ctx: Context) => {
      const out = new ContainerDefinition();
      out.cpu = c?.cpu;
      out.envVariables = {};
      c.environment.map((ev: { name: string, value: string }) => {
        out.envVariables[ev.name] = ev.value;
      });
      out.essential = c.essential;
      out.memory = c.memory;
      out.memoryReservation = c.memoryReservation;
      out.name = c.name;
      const portMapping = c.portMappings?.pop();
      out.containerPort = portMapping?.containerPort;
      out.hostPort = portMapping?.hostPort;
      out.protocol = portMapping?.protocol;
      let containerImage;
      if (c?.image?.includes('@')) {  // Image with digest
        const split = c.image.split('@');
        containerImage = split[0];
        out.digest = split[1];
      } else if (c?.image?.includes(':')) {  // Image with tag
        const split = c.image.split(':');
        containerImage = split[0];
        out.tag = split[1];
      } else {  // Just image name
        containerImage = c?.image;
      }
      if (containerImage?.includes('amazonaws.com')) {  // Private ECR
        const parts = containerImage.split('/');
        const repositoryName = parts[parts.length - 1] ?? null;
        try {
          const repository = await awsEcrModule.repository.db.read(ctx, repositoryName) ??
            await awsEcrModule.repository.cloud.read(ctx, repositoryName);
          out.repository = repository;
        } catch (e) {
          // Repository could have been deleted
          logger.error('Repository not found', e as any);
          out.repository = undefined;
        }
      } else if (containerImage?.includes('public.ecr.aws')) {  // Public ECR
        const parts = containerImage.split('/');
        const publicRepositoryName = parts[parts.length - 1] ?? null;
        try {
          const publicRepository = await awsEcrModule.publicRepository.db.read(ctx, publicRepositoryName) ??
            await awsEcrModule.publicRepository.cloud.read(ctx, publicRepositoryName);
          out.publicRepository = publicRepository;
        } catch (e) {
          // Repository could have been deleted
          logger.error('Repository not found', e as any);
          out.publicRepository = undefined;
        }
      }
      if (!out.repository && !out.publicRepository) {
        out.image = containerImage;
      }
      // TODO: eventually handle more log drivers
      if (c.logConfiguration?.logDriver === 'awslogs') {
        const groupName = c.logConfiguration.options['awslogs-group'];
        const logGroup = await awsCloudwatchModule.logGroup.db.read(ctx, groupName) ?? await awsCloudwatchModule.logGroup.cloud.read(ctx, groupName);
        out.logGroup = logGroup;
      }
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new TaskDefinition();
      out.containerDefinitions = [];
      for (const tdc of td.containerDefinitions) {
        const cd = await AwsEcsFargateModule.utils.containerDefinitionMapper(tdc, ctx);
        out.containerDefinitions.push(cd);
      }
      out.cpuMemory = `vCPU${+(td.cpu ?? '256') / 1024}-${+(td.memory ?? '512') / 1024}GB` as CpuMemCombination;
      if (td.executionRoleArn) {
        const roleName = awsIamModule.role.roleNameFromArn(td.executionRoleArn, ctx);
        // there can be hundreds of task defintions so don't do an aws call for each
        if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
          try {
            out.executionRole = await awsIamModule.role.db.read(ctx, roleName) ??
              await awsIamModule.role.cloud.read(ctx, roleName);
          } catch (e) {
            // Role could have been deleted
            logger.error('Role not found', e as any);
            out.executionRole = undefined;
          }
        } else {
          out.executionRole = await awsIamModule.role.db.read(ctx, roleName) ??
            ctx?.memo?.cloud?.Role?.[roleName ?? ''];
        }
      }
      out.family = td.family;
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      if (td.taskRoleArn) {
        const roleName = awsIamModule.role.roleNameFromArn(td.taskRoleArn, ctx);
        // there can be hundreds of task defintions so don't do an aws call for each
        if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
          try {
            out.taskRole = await awsIamModule.role.db.read(ctx, roleName) ??
              await awsIamModule.role.cloud.read(ctx, roleName);
          } catch (e) {
            // Role could have been deleted
            logger.error('Role not found', e as any);
            out.taskRole = undefined;
          }
        } else {
          out.taskRole = await awsIamModule.role.db.read(ctx, roleName) ??
            ctx?.memo?.cloud?.Role?.[roleName ?? ''];
        }
      }
      return out;
    },
    serviceMapper: async (s: any, ctx: Context) => {
      const out = new Service();
      out.arn = s.serviceArn;
      if (s.clusterArn) {
        out.cluster = await AwsEcsFargateModule.mappers.cluster.db.read(ctx, s.clusterArn) ?? await AwsEcsFargateModule.mappers.cluster.cloud.read(ctx, s.clusterArn);
      }
      out.desiredCount = s.desiredCount;
      const taskDefinition = await AwsEcsFargateModule.mappers.taskDefinition.db.read(ctx, s.taskDefinition) ??
      await AwsEcsFargateModule.mappers.taskDefinition.cloud.read(ctx, s.taskDefinition);
      if (!taskDefinition) throw new Error('Task definitions need to be loaded first');
      out.task = taskDefinition;
      const serviceLoadBalancer = s.loadBalancers.pop();
      if (serviceLoadBalancer) {
        try {
          out.targetGroup = await AwsElbModule.mappers.targetGroup.db.read(ctx, serviceLoadBalancer.targetGroupArn) ??
            await AwsElbModule.mappers.targetGroup.cloud.read(ctx, serviceLoadBalancer.targetGroupArn);
        } catch (_) {
          // Ignore if misconfigured
          if (!out.targetGroup) return undefined;
        }
      }
      out.name = s.serviceName;
      if (s.networkConfiguration?.awsvpcConfiguration) {
        const networkConf = s.networkConfiguration.awsvpcConfiguration;
        out.assignPublicIp = networkConf.assignPublicIp;
        const securityGroups = [];
        const cloudSecurityGroups = networkConf.securityGroups ?? [];
        for (const sg of cloudSecurityGroups) {
          securityGroups.push(await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg) ??
            await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sg));
        }
        if (securityGroups.filter(sg => !!sg).length !== cloudSecurityGroups.length) throw new Error('Security groups need to be loaded first')
        out.securityGroups = securityGroups;
        for (const sn of networkConf.subnets ?? []) {
          // Even though we already have the subnet ids, we look for them to avoid having misconfigured resources
          let subnet: Subnet;
          try {
            subnet = await AwsVpcModule.mappers.subnet.db.read(ctx, sn) ??
              await AwsVpcModule.mappers.subnet.cloud.read(ctx, sn);
            if (!subnet) return undefined;
          } catch (e: any) {
            if (e.Code === 'InvalidSubnetID.NotFound') return undefined;
          }
        }
        out.subnets = networkConf.subnets ?? [];
      }
      out.status = s.status;
      out.forceNewDeployment = false;
      return out;
    },
    containersEq: (a: ContainerDefinition, b: ContainerDefinition) => Object.is(a.cpu, b.cpu)
      && Object.is(Object.keys(a.envVariables ?? {}).length, Object.keys(b.envVariables ?? {}).length)
      && Object.keys(a.envVariables ?? {}).every((aevk: string) => !!Object.keys(b.envVariables ?? {}).find((bevk: string) => Object.is(aevk, bevk) && Object.is(a.envVariables[aevk], b.envVariables[bevk])))
      && Object.is(a.essential, b.essential)
      && Object.is(a.logGroup?.logGroupArn, b.logGroup?.logGroupArn)
      && Object.is(a.memory, b.memory)
      && Object.is(a.memoryReservation, b.memoryReservation)
      && Object.is(a.name, b.name)
      && Object.is(a.containerPort, b.containerPort)
      && Object.is(a.hostPort, b.hostPort)
      && Object.is(a.protocol, b.protocol)
      && Object.is(a.publicRepository?.repositoryName, b.publicRepository?.repositoryName)
      && Object.is(a.repository?.repositoryName, b.repository?.repositoryName)
      && Object.is(a.image, b.image)
      && Object.is(a.digest, b.digest)
      && Object.is(a.tag, b.tag),
  },
  mappers: {
    cluster: new Mapper2<Cluster>({
      entity: Cluster,
      equals: (a: Cluster, b: Cluster) => Object.is(a.clusterArn, b.clusterArn)
        && Object.is(a.clusterName, b.clusterName)
        && Object.is(a.clusterStatus, b.clusterStatus),
      source: 'db',
      cloud: new Crud2({
        create: async (es: Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const result = await createCluster(client.ecsClient, {
              clusterName: e.clusterName,
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('clusterArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await getCluster(client.ecsClient, result.clusterArn!);
            if (!newObject) continue;
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsFargateModule.utils.clusterMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcsFargateModule.mappers.cluster.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawCluster = await getCluster(client.ecsClient, id);
            if (!rawCluster) return;
            return AwsEcsFargateModule.utils.clusterMapper(rawCluster, ctx);
          } else {
            const clusters = await getClusters(client.ecsClient) ?? [];
            return clusters.map((c: any) => AwsEcsFargateModule.utils.clusterMapper(c, ctx));
          }
        },
        updateOrReplace: (prev: Cluster, next: Cluster) => {
          if (!Object.is(prev.clusterName, next.clusterName)) return 'replace';
          return 'update';
        },
        update: async (es: Cluster[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Cluster?.[e.clusterArn ?? ''];
            const isUpdate = AwsEcsFargateModule.mappers.cluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              await AwsEcsFargateModule.mappers.cluster.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id in database will be the same `e` will keep it.
              await AwsEcsFargateModule.mappers.cluster.cloud.delete(cloudRecord, ctx);
              out.push(await AwsEcsFargateModule.mappers.cluster.cloud.create(e, ctx));
            }
          }
          return out;
        },
        delete: async (es: Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            if (e.clusterStatus === 'INACTIVE' && e.clusterName === 'default') {
              const dbCluster = await AwsEcsFargateModule.mappers.cluster.db.read(ctx, e.clusterArn);
              // Temporarily create again the default inactive cluster if deleted from DB to avoid infinite loops.
              if (!dbCluster) {
                await AwsEcsFargateModule.mappers.cluster.db.create(e, ctx);
              }
            } else {
              await deleteCluster(client, e.clusterName)
            }
          }
        },
      }),
    }),
    taskDefinition: new Mapper2<TaskDefinition>({
      entity: TaskDefinition,
      equals: (a: TaskDefinition, b: TaskDefinition) => Object.is(a.cpuMemory, b.cpuMemory)
        && Object.is(a.executionRole?.arn, b.executionRole?.arn)
        && Object.is(a.family, b.family)
        && Object.is(a.revision, b.revision)
        && Object.is(a.status, b.status)
        && Object.is(a.taskDefinitionArn, b.taskDefinitionArn)
        && Object.is(a.taskRole?.arn, b.taskRole?.arn)
        && Object.is(a.containerDefinitions.length, b.containerDefinitions.length)
        && a.containerDefinitions.every(ac => !!b.containerDefinitions.find(bc => AwsEcsFargateModule.utils.containersEq(ac, bc))),
      source: 'db',
      cloud: new Crud2({
        create: async (es: TaskDefinition[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const res = [];
          for (const e of es) {
            const containerDefinitions = e.containerDefinitions?.map(c => {
              const container: any = { ...c };
              let image;
              if (c.image) {
                image = c.image;
              } else if (c.repository) {
                if (!c.repository?.repositoryUri) {
                  throw new Error('Repository need to be created first');
                }
                image = c.repository.repositoryUri;
              } else if (c.publicRepository) {
                if (!c.publicRepository?.repositoryUri) {
                  throw new Error('Public repository need to be created first');
                }
                image = c.publicRepository.repositoryUri;
              } else {
                logger.error('How the DB constraint have been ignored?');
              }
              if (c.digest) {
                container.image = `${image}@${c.digest}`;
              } else if (c.tag) {
                container.image = `${image}:${c.tag}`;
              } else {
                container.image = image;
              }
              if (container.logGroup) {
                // TODO: improve log configuration
                container.logConfiguration = {
                  logDriver: 'awslogs',
                  options: {
                    "awslogs-group": container.logGroup.logGroupName,
                    "awslogs-region": client.region,
                    "awslogs-stream-prefix": `awslogs-${c.name}`
                  }
                };
              }
              if (c.envVariables && Array.isArray(c.envVariables)) throw new Error('Invalid environment variables format');
              container.environment = Object.keys(c.envVariables ?? {}).map((evk: string) => ({ name: evk, value: `${c.envVariables[evk]}`}));
              if (container.containerPort && container.hostPort && container.protocol) {
                container.portMappings = [{
                  containerPort: container.containerPort,
                  hostPort: container.hostPort,
                  protocol: container.protocol,
                }];
              }
              return container;
            }) ?? [];
            if (!containerDefinitions.length) throw new Error(`Task definition ${e.family}${e.revision ? `:${e.revision}` : ''} does not have any container associated.`);
            const input: any = {
              family: e.family,
              containerDefinitions,
              requiresCompatibilities: ['FARGATE',],
              networkMode: 'awsvpc',
              taskRoleArn: e.taskRole?.arn,
              executionRoleArn: e.executionRole?.arn,
            };
            if (e.cpuMemory) {
              const [cpuStr, memoryStr] = e.cpuMemory.split('-');
              const cpu = cpuStr.split('vCPU')[1];
              input.cpu = `${+cpu * 1024}`;
              const memory = memoryStr.split('GB')[0];
              input.memory = `${+memory * 1024}`;
            }
            const result = await createTaskDefinition(client.ecsClient, input);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('taskDefinitionArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await getTaskDefinition(client.ecsClient, result.taskDefinitionArn ?? '');
            if (!newObject) continue;
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsFargateModule.utils.taskDefinitionMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Keep container definition ids to avoid duplicates
            e.containerDefinitions?.forEach(c => {
              newEntity?.containerDefinitions?.forEach((nc: any) => {
                if (nc.name === c.name) {
                  nc.id = c.id;
                  // TODO KEEP TRACK OF PORT AND ENV IDS?
                }
              })
            });
            // Save the record back into the database to get the new fields updated
            await AwsEcsFargateModule.mappers.taskDefinition.db.update(newEntity, ctx);
            res.push(newEntity);
          }
          return res;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawTaskDef = await getTaskDefinition(client.ecsClient, id);
            if (!rawTaskDef) return;
            if (!rawTaskDef.compatibilities?.includes('FARGATE')) return;
            return await AwsEcsFargateModule.utils.taskDefinitionMapper(rawTaskDef, ctx);
          } else {
            const taskDefs = ((await getTaskDefinitions(client.ecsClient)).taskDefinitions ?? [])
              .filter(td => td.compatibilities.includes('FARGATE'));
            const tds = [];
            for (const td of taskDefs) {
              tds.push(await AwsEcsFargateModule.utils.taskDefinitionMapper(td, ctx))
            }
            return tds;
          }
        },
        updateOrReplace: () => 'update',
        update: async (es: TaskDefinition[], ctx: Context) => {
          const res = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.TaskDefinition?.[e.taskDefinitionArn ?? ''];
            // Any change in a task definition will imply the creation of a new revision and to restore the previous value.
            const newRecord = { ...e };
            cloudRecord.id = e.id;
            cloudRecord.containerDefinitions.map((crc: ContainerDefinition) => {
              const c = e.containerDefinitions.find(ec => AwsEcsFargateModule.utils.containersEq(ec, crc));
              if (!!c) crc.id = c.id;
            });
            newRecord.id = undefined;
            newRecord.taskDefinitionArn = undefined;
            newRecord.containerDefinitions = newRecord.containerDefinitions.map(c => {
              c.id = undefined;
              return c;
            });
            await AwsEcsFargateModule.mappers.taskDefinition.db.create(newRecord, ctx);
            await AwsEcsFargateModule.mappers.taskDefinition.db.update(cloudRecord, ctx);
            res.push(cloudRecord);
          }
          return res;
        },
        delete: async (es: TaskDefinition[], ctx: Context) => {
          // Do not delete task if it is being used by a service
          const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsFargateModule.mappers.service.cloud.read(ctx);
          const client = await ctx.getAwsClient() as AWS;
          const esWithServiceAttached = [];
          const esToDelete = [];
          for (const e of es) {
            if (Object.values(services).find((s: any) => s.task?.taskDefinitionArn === e.taskDefinitionArn)) {
              esWithServiceAttached.push(e);
            } else {
              if (e.status === 'INACTIVE') {
                const dbTd = await AwsEcsFargateModule.mappers.taskDefinition.db.read(ctx, e.taskDefinitionArn);
                // Temporarily create again the task definition inactive if deleted from DB to avoid infinite loops.
                // ? Eventually, forbid task definitons to be deleted from database.
                if (!dbTd || (Array.isArray(dbTd) && !dbTd.length)) {
                  await AwsEcsFargateModule.mappers.taskDefinition.db.create(e, ctx);
                }
              } else {
                esToDelete.push(e)
              }
            }
          };
          for (const e of esToDelete) {
            await deleteTaskDefinition(client.ecsClient, e.taskDefinitionArn!);
          }
          if (esWithServiceAttached.length) {
            throw new Error('Some tasks could not be deleted. They are attached to an existing service.')
          }
        },
      }),
    }),
    service: new Mapper2<Service>({
      entity: Service,
      equals: (a: Service, b: Service) => Object.is(a.desiredCount, b.desiredCount)
        && Object.is(a.task?.taskDefinitionArn, b.task?.taskDefinitionArn)
        && Object.is(a.cluster?.clusterName, b.cluster?.clusterName)
        && Object.is(a.arn, b.arn)
        && Object.is(a.targetGroup?.targetGroupArn, b.targetGroup?.targetGroupArn)
        && Object.is(a.name, b.name)
        && Object.is(a.status, b.status)
        && Object.is(a?.assignPublicIp, b?.assignPublicIp)
        && Object.is(a?.securityGroups?.length, b?.securityGroups?.length)
        && (a?.securityGroups?.every(asg => !!b?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
        && Object.is(a?.subnets?.length, b?.subnets?.length)
        && (a?.subnets?.every(asn => !!b?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false)
        && Object.is(a.forceNewDeployment, b.forceNewDeployment),
      source: 'db',
      cloud: new Crud2({
        create: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const res = [];
          for (const e of es) {
            if (!e.task?.taskDefinitionArn) {
              throw new Error('task definition need to be created first')
            }
            const input: any = {
              serviceName: e.name,
              taskDefinition: e.task?.taskDefinitionArn,
              launchType: 'FARGATE',
              cluster: e.cluster?.clusterName,
              schedulingStrategy: 'REPLICA',
              desiredCount: e.desiredCount,
              networkConfiguration: {
                awsvpcConfiguration: {
                  subnets: e.subnets?.length ? e.subnets : [],
                  securityGroups: e.securityGroups.map(sg => sg.groupId!),
                  assignPublicIp: e.assignPublicIp,
                }
              },
            };
            // Add load balancer to the first essential container. Theres always one essential container definition.
            const essentialContainer = e.task.containerDefinitions.find(cd => cd.essential);
            if (e.targetGroup && essentialContainer?.containerPort) {
              input.loadBalancers = [{
                targetGroupArn: e.targetGroup?.targetGroupArn,
                containerName: essentialContainer?.name,
                containerPort: essentialContainer?.containerPort,
              }];
            }
            const result = await createService(client.ecsClient, input);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('serviceName') || !result?.hasOwnProperty('clusterArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await getService(client.ecsClient, result.serviceName!, result.clusterArn!);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsFargateModule.utils.serviceMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcsFargateModule.mappers.service.db.update(newEntity, ctx);
            res.push(newEntity);
          }
          return res;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          // TODO: Refactor this. I don't think the `ids` branch has been tested, either. So I don't want to touch it
          if (id) {
            const services = ctx.memo?.cloud?.Service ?
              Object.values(ctx.memo?.cloud?.Service) :
              await AwsEcsFargateModule.mappers.service.cloud.read(ctx);
            const service = services?.find((s: any) => s?.arn === id);
            if (!service) return;
            const rawService = await getService(client.ecsClient, id, service.cluster.clusterArn);
            if (!rawService) return;
            return await AwsEcsFargateModule.utils.serviceMapper(rawService, ctx);
          } else {
            const clusters = ctx.memo?.cloud?.Cluster ? Object.values(ctx.memo?.cloud?.Cluster) : await AwsEcsFargateModule.mappers.cluster.cloud.read(ctx);
            const result = await getServices(client.ecsClient, clusters?.map((c: any) => c.clusterArn) ?? []);
            // Make sure we just handle FARGATE services
            const fargateResult = result.filter(s => s.launchType === 'FARGATE');
            const out = [];
            for (const s of fargateResult) {
              const mappedService = await AwsEcsFargateModule.utils.serviceMapper(s, ctx);
              if (mappedService) out.push(mappedService);
            }
            return out;
          }
        },
        updateOrReplace: (prev: Service, next: Service) => {
          if (!(Object.is(prev.name, next.name)
            && Object.is(prev.cluster?.clusterArn, next.cluster?.clusterArn)
            && Object.is(prev?.assignPublicIp, next?.assignPublicIp)
            && Object.is(prev?.securityGroups?.length, next?.securityGroups?.length)
            && (prev?.securityGroups?.every(asg => !!next?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
            && Object.is(prev?.subnets?.length, next?.subnets?.length)
            && (prev?.subnets?.every(asn => !!next?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false)
            && Object.is(prev.targetGroup?.targetGroupArn, next.targetGroup?.targetGroupArn))) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const res = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Service?.[e.arn ?? ''];
            const isUpdate = AwsEcsFargateModule.mappers.service.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              // Desired count or task definition
              if (!(Object.is(e.desiredCount, cloudRecord.desiredCount) && Object.is(e.task?.taskDefinitionArn, cloudRecord.task?.taskDefinitionArn)
                    && Object.is(e.forceNewDeployment, cloudRecord.forceNewDeployment))) {
                const updatedService = await updateService(client.ecsClient, {
                  service: e.name,
                  cluster: e.cluster?.clusterName,
                  taskDefinition: e.task?.taskDefinitionArn,
                  desiredCount: e.desiredCount,
                  forceNewDeployment: e.forceNewDeployment,
                });
                const s = await AwsEcsFargateModule.utils.serviceMapper(updatedService, ctx);
                await AwsEcsFargateModule.mappers.service.db.update(s, ctx);
                res.push(s);
                continue;
              }
              // Restore values
              await AwsEcsFargateModule.mappers.service.db.update(cloudRecord, ctx);
              res.push(cloudRecord);
              continue;
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id in database will be the same `e` will keep it.
              await AwsEcsFargateModule.mappers.service.cloud.delete(cloudRecord, ctx);
              res.push(await AwsEcsFargateModule.mappers.service.cloud.create(e, ctx));
              continue;
            }
          }
          return res;
        },
        delete: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const t0 = Date.now();
          for (const e of es) {
            const t1 = Date.now();
            e.desiredCount = 0;
            await updateService(client.ecsClient, {
              service: e.name,
              cluster: e.cluster?.clusterName,
              desiredCount: e.desiredCount,
            });
            const t2 = Date.now();
            logger.info(`Setting service ${e.name} desired count to 0 in ${t2 - t1}ms`);
            await deleteServiceOnly(client.ecsClient, e.name, e.cluster?.clusterArn!);
            const t3 = Date.now();
            logger.info(`Deleting service ${e.name} in ${t3 - t2}ms`);
          }
          const tn = Date.now();
          logger.info(`Service cloud mapper delete completed in ${tn - t0}ms`);
        },
      }),
    }),
  },
}, __dirname);
