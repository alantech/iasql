import { AWS, } from '../../services/gateways/aws'
import {
  Cluster,
  ContainerDefinition,
  CpuMemCombination,
  Service,
  TaskDefinition,
} from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsEcrModule, AwsElbModule, AwsIamModule, AwsSecurityGroupModule, AwsCloudwatchModule } from '..'
import * as metadata from './module.json'
import logger from '../../services/logger'

export const AwsEcsFargateModule: Module = new Module({
  ...metadata,
  utils: {
    clusterMapper: (c: any, _ctx: Context) => {
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
          const repository = await AwsEcrModule.mappers.repository.db.read(ctx, repositoryName) ??
            await AwsEcrModule.mappers.repository.cloud.read(ctx, repositoryName);
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
          const publicRepository = await AwsEcrModule.mappers.publicRepository.db.read(ctx, publicRepositoryName) ??
            await AwsEcrModule.mappers.publicRepository.cloud.read(ctx, publicRepositoryName);
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
        const logGroup = await AwsCloudwatchModule.mappers.logGroup.db.read(ctx, groupName) ?? await AwsCloudwatchModule.mappers.logGroup.cloud.read(ctx, groupName);
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
        const roleName = AwsIamModule.utils.roleNameFromArn(td.executionRoleArn);
        // there can be hundreds of task defintions so don't do an aws call for each
        if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
          try {
            out.executionRole = await AwsIamModule.mappers.role.db.read(ctx, roleName) ??
              await AwsIamModule.mappers.role.cloud.read(ctx, roleName);
          } catch (e) {
            // Role could have been deleted
            logger.error('Role not found', e as any);
            out.executionRole = undefined;
          }
        } else {
          out.executionRole = await AwsIamModule.mappers.role.db.read(ctx, roleName) ??
            ctx?.memo?.cloud?.Role?.[roleName ?? ''];
        }
      }
      out.family = td.family;
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      if (td.taskRoleArn) {
        const roleName = AwsIamModule.utils.roleNameFromArn(td.taskRoleArn);
        // there can be hundreds of task defintions so don't do an aws call for each
        if (!Object.values(ctx.memo?.cloud?.Role ?? {}).length) {
          try {
            out.taskRole = await AwsIamModule.mappers.role.db.read(ctx, roleName) ??
              await AwsIamModule.mappers.role.cloud.read(ctx, roleName);
          } catch (e) {
            // Role could have been deleted
            logger.error('Role not found', e as any);
            out.taskRole = undefined;
          }
        } else {
          out.taskRole = await AwsIamModule.mappers.role.db.read(ctx, roleName) ??
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
        out.targetGroup = await AwsElbModule.mappers.targetGroup.db.read(ctx, serviceLoadBalancer.targetGroupArn) ??
          await AwsElbModule.mappers.targetGroup.cloud.read(ctx, serviceLoadBalancer.targetGroupArn);
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
    cluster: new Mapper<Cluster>({
      entity: Cluster,
      equals: (a: Cluster, b: Cluster) => Object.is(a.clusterArn, b.clusterArn)
        && Object.is(a.clusterName, b.clusterName)
        && Object.is(a.clusterStatus, b.clusterStatus),
      source: 'db',
      cloud: new Crud({
        create: async (es: Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const result = await client.createCluster({
              clusterName: e.clusterName,
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('clusterArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getCluster(result.clusterArn!);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsFargateModule.utils.clusterMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcsFargateModule.mappers.cluster.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const clusters = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getCluster(id))) :
            await client.getClusters() ?? [];
          return await Promise.all(clusters.map((c: any) => AwsEcsFargateModule.utils.clusterMapper(c, ctx)));
        },
        updateOrReplace: (prev: Cluster, next: Cluster) => {
          if (!Object.is(prev.clusterName, next.clusterName)) return 'replace';
          return 'update';
        },
        update: async (es: Cluster[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Cluster?.[e.clusterArn ?? ''];
            const isUpdate = AwsEcsFargateModule.mappers.cluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              await AwsEcsFargateModule.mappers.cluster.db.update(cloudRecord, ctx);
              return cloudRecord;
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id in database will be the same `e` will keep it.
              await AwsEcsFargateModule.mappers.cluster.cloud.delete(cloudRecord, ctx);
              return await AwsEcsFargateModule.mappers.cluster.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (es: Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async e => {
            if (e.clusterStatus === 'INACTIVE' && e.clusterName === 'default') {
              const dbCluster = await AwsEcsFargateModule.mappers.cluster.db.read(ctx, e.clusterArn);
              // Temporarily create again the default inactive cluster if deleted from DB to avoid infinite loops.
              if (!dbCluster) {
                await AwsEcsFargateModule.mappers.cluster.db.create(e, ctx);
              }
            } else {
              return await client.deleteCluster(e.clusterName)
            }
          }));
        },
      }),
    }),
    taskDefinition: new Mapper<TaskDefinition>({
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
      cloud: new Crud({
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
            const result = await client.createTaskDefinition(input);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('taskDefinitionArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getTaskDefinition(result.taskDefinitionArn ?? '');
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
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          let taskDefs = [];
          if (Array.isArray(ids)) {
            for (const id of ids ?? []) {
              taskDefs.push(await client.getTaskDefinition(id));
            }
          } else {
            taskDefs = (await client.getTaskDefinitions()).taskDefinitions ?? [];
            // Make sure we just handle tasks compatibles with FARGATE
            taskDefs = taskDefs.filter(td => td.compatibilities.includes('FARGATE'));
          }
          const tds = [];
          for (const td of taskDefs) {
            tds.push(await AwsEcsFargateModule.utils.taskDefinitionMapper(td, ctx))
          }
          return tds;
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
            await client.deleteTaskDefinition(e.taskDefinitionArn!);
          }
          if (esWithServiceAttached.length) {
            throw new Error('Some tasks could not be deleted. They are attached to an existing service.')
          }
        },
      }),
    }),
    service: new Mapper<Service>({
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
      cloud: new Crud({
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
            const result = await client.createService(input);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('serviceName') || !result?.hasOwnProperty('clusterArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getService(result.serviceName!, result.clusterArn!);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsFargateModule.utils.serviceMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcsFargateModule.mappers.service.db.update(newEntity, ctx);
            res.push(newEntity);
          }
          return res;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          // TODO: Refactor this. I don't think the `ids` branch has been tested, either. So I don't want to touch it
          if (ids) {
            const out = [];
            for (const id of ids) {
              const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsFargateModule.mappers.service.cloud.read(ctx);
              const service = services?.find((s: any) => s.arn === id);
              if (service) {
                out.push(await AwsEcsFargateModule.utils.serviceMapper(
                  await client.getService(id, service.cluster.clusterArn), ctx
                ));
              }
            }
            return out;
          } else {
            const clusters = ctx.memo?.cloud?.Cluster ? Object.values(ctx.memo?.cloud?.Cluster) : await AwsEcsFargateModule.mappers.cluster.cloud.read(ctx);
            const result = await client.getServices(clusters?.map((c: any) => c.clusterArn) ?? []);
            // Make sure we just handle FARGATE services
            const fargateResult = result.filter(s => s.launchType === 'FARGATE');
            const out = [];
            for (const s of fargateResult) {
              out.push(await AwsEcsFargateModule.utils.serviceMapper(s, ctx));
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
                const updatedService = await client.updateService({
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
          for (const e of es) {
            const tasksArns = await client.getTasksArns(e.cluster?.clusterName!, e.name);
            e.desiredCount = 0;
            await client.updateService({
              service: e.name,
              cluster: e.cluster?.clusterName,
              desiredCount: e.desiredCount,
            });
            await client.deleteService(e.name, e.cluster?.clusterArn!, tasksArns)
          }
        },
      }),
    }),
  },
}, __dirname);
