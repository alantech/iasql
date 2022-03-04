import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import {
  AwsCluster,
  AwsContainerDefinition,
  CpuMemCombination,
  AwsService,
  AwsTaskDefinition,
  TaskDefinitionStatus,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsEcrModule, AwsElbModule, AwsSecurityGroupModule, AwsCloudwatchModule, } from '..'
import { awsEcsFargate1646390160682, } from './migration/1646390160682-aws_ecs_fargate'

export const AwsEcsFargateModule: Module = new Module({
  name: 'aws_ecs_fargate',
  version: '0.0.1',
  dependencies: [
    'aws_account@0.0.1',
    'aws_ecr@0.0.1',
    'aws_elb@0.0.1',
    'aws_security_group@0.0.1',
    'aws_cloudwatch@0.0.1',
  ],
  provides: {
    entities: allEntities,
    tables: ['aws_cluster', 'aws_container_definition', 'env_variable', 'port_mapping', 'aws_task_definition', 'aws_service',],
    functions: [
      'create_or_update_ecs_cluster', 'create_container_definition', 'create_task_definition', 'create_or_update_ecs_service',
      'delete_ecs_service', 'delete_task_definition', 'delete_container_definition', 'delete_ecs_cluster',
    ],
  },
  utils: {
    clusterMapper: (c: any, _ctx: Context) => {
      const out = new AwsCluster();
      out.clusterName = c.clusterName ?? 'default';
      out.clusterArn = c.clusterArn ?? null;
      out.clusterStatus = c.status ?? null;
      return out;
    },
    containerDefinitionMapper: async (c: any, ctx: Context) => {
      const out = new AwsContainerDefinition();
      out.cpu = c?.cpu;
      out.envVariables = c.environment ?? [];
      out.essential = c.essential;
      out.memory = c.memory;
      out.memoryReservation = c.memoryReservation;
      out.name = c.name;
      const portMapping = c.portMappings?.[0];
      out.containerPort = portMapping.containerPort;
      out.hostPort = portMapping.hostPort;
      out.protocol = portMapping.protocol;
      const imageTag = c.image?.split(':');
      if (imageTag[0]?.includes('amazonaws.com')) {
        const repositoryName = imageTag[0].split('/')[1] ?? null;
        try {
          const repository = await AwsEcrModule.mappers.repository.db.read(ctx, repositoryName) ?? await AwsEcrModule.mappers.repository.cloud.read(ctx, repositoryName);
          out.repository = repository;
        } catch (e) {
          // Repository could have been deleted
          console.error(e);
          out.repository = undefined;
        }
      } else if (imageTag[0]?.includes('public.ecr.aws')) {
        const publicRepositoryName = imageTag[0].split('/')[2] ?? null;
        try {
          const publicRepository = await AwsEcrModule.mappers.publicRepository.db.read(ctx, publicRepositoryName) ??
            await AwsEcrModule.mappers.publicRepository.cloud.read(ctx, publicRepositoryName);
          out.publicRepository = publicRepository;
        } catch (e) {
          // Repository could have been deleted
          console.error(e);
          out.publicRepository = undefined;
        }
      } else {
        out.dockerImage = imageTag[0];
      }
      out.tag = imageTag[1];
      // TODO: eventually handle more log drivers
      if (c.logConfiguration?.logDriver === 'awslogs') {
        const groupName = c.logConfiguration.options['awslogs-group'];
        const logGroup = await AwsCloudwatchModule.mappers.logGroup.db.read(ctx, groupName) ?? await AwsCloudwatchModule.mappers.logGroup.cloud.read(ctx, groupName);
        out.logGroup = logGroup;
      }
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new AwsTaskDefinition();
      out.containerDefinitions = [];
      for (const tdc of td.containerDefinitions) {
        const cd = await AwsEcsFargateModule.utils.containerDefinitionMapper(tdc, ctx);
        out.containerDefinitions.push(cd);
      }
      out.cpuMemory = `${+(td.cpu ?? '256') / 1024}vCPU-${+(td.memory ?? '512') / 1024}GB` as CpuMemCombination;
      out.executionRoleArn = td.executionRoleArn;
      out.family = td.family;
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      out.taskRoleArn = td.taskRoleArn;
      return out;
    },
    serviceMapper: async (s: any, ctx: Context) => {
      const out = new AwsService();
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
        out.containerDefinition = out.task?.containerDefinitions.find(c => c.name === serviceLoadBalancer.containerName);
      }
      out.name = s.serviceName;
      if (s.networkConfiguration?.awsvpcConfiguration) {
        const networkConf = s.networkConfiguration.awsvpcConfiguration;
        out.assignPublicIp = networkConf.assignPublicIp;
        out.securityGroups = networkConf.securityGroups?.length ?
          await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, networkConf.securityGroups) ??
            await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, networkConf.securityGroups)
          : []
        out.subnets = networkConf.subnets ?? [];
      }
      out.status = s.status;
      return out;
    },
    containersEq: (a: AwsContainerDefinition, b: AwsContainerDefinition) => Object.is(a.cpu, b.cpu)
      && Object.is(a.dockerImage, b.dockerImage)
      && Object.is(a.envVariables.length, b.envVariables.length)
      && a.envVariables.every(aev => !!b.envVariables.find(bev => Object.is(aev.name, bev.name) && Object.is(aev.value, bev.value)))
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
      && Object.is(a.tag, b.tag),
  },
  mappers: {
    cluster: new Mapper<AwsCluster>({
      entity: AwsCluster,
      entityId: (e: AwsCluster) => e?.clusterArn ?? 'default',
      entityPrint: (e: AwsCluster) => ({
        id: e?.id?.toString() ?? '',
        clusterName: e?.clusterName ?? '',
        clusterArn: e?.clusterArn ?? '',
        clusterStatus: e?.clusterStatus ?? '',
      }),
      equals: (a: AwsCluster, b: AwsCluster) => Object.is(a.clusterArn, b.clusterArn)
        && Object.is(a.clusterName, b.clusterName)
        && Object.is(a.clusterStatus, b.clusterStatus),
      source: 'db',
      db: new Crud({
        create: (c: AwsCluster[], ctx: Context) => ctx.orm.save(AwsCluster, c),
        read: async (ctx: Context, ids?: string[]) => ctx.orm.find(AwsCluster, ids ? {
          where: {
            clusterArn: In(ids),
          },
        } : undefined),
        update: (c: AwsCluster[], ctx: Context) => ctx.orm.save(AwsCluster, c),
        delete: (c: AwsCluster[], ctx: Context) => ctx.orm.remove(AwsCluster, c),
      }),
      cloud: new Crud({
        create: async (es: AwsCluster[], ctx: Context) => {
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
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
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
        updateOrReplace: (prev: AwsCluster, next: AwsCluster) => {
          if (!Object.is(prev.clusterName, next.clusterName)) return 'replace';
          return 'update';
        },
        update: async (es: AwsCluster[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Cluster?.[e.clusterArn ?? ''];
            const isUpdate = AwsEcsFargateModule.mappers.cluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              cloudRecord.id = e.id;
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
        delete: async (es: AwsCluster[], ctx: Context) => {
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
    taskDefinition: new Mapper<AwsTaskDefinition>({
      entity: AwsTaskDefinition,
      entityId: (e: AwsTaskDefinition) => e?.taskDefinitionArn ?? '',
      entityPrint: (e: AwsTaskDefinition) => ({
        id: e?.id?.toString() ?? '',
        taskDefinitionArn: e?.taskDefinitionArn ?? '',
        containerDefinitions: e?.containerDefinitions?.map(c => c?.name ?? '').join(', ') ?? '',
        family: e?.family ?? '',
        revision: e?.revision?.toString() ?? '',
        taskRoleArn: e?.taskRoleArn ?? '',
        executionRoleArn: e?.executionRoleArn ?? '',
        status: e?.status ?? 'UNKNOWN',
        cpuMemory: e?.cpuMemory ?? 'UNKNOWN',
      }),
      equals: (a: AwsTaskDefinition, b: AwsTaskDefinition) => Object.is(a.cpuMemory, b.cpuMemory)
        && Object.is(a.executionRoleArn, b.executionRoleArn)
        && Object.is(a.family, b.family)
        && Object.is(a.revision, b.revision)
        && Object.is(a.status, b.status)
        && Object.is(a.taskDefinitionArn, b.taskDefinitionArn)
        && Object.is(a.taskRoleArn, b.taskRoleArn)
        && (a.status === TaskDefinitionStatus.ACTIVE && b.status === TaskDefinitionStatus.ACTIVE ? Object.is(a.containerDefinitions.length, b.containerDefinitions.length)
          && a.containerDefinitions.every(ac => !!b.containerDefinitions.find(bc => AwsEcsFargateModule.utils.containersEq(ac, bc))) : true),
      source: 'db',
      db: new Crud({
        create: async (es: AwsTaskDefinition[], ctx: Context) => {
          es.forEach((entity: AwsTaskDefinition) => {
            const containerDefinitions: any = entity?.containerDefinitions?.map(cd => {
              // For INACTIVE tasks it is not necessary to exists a ecr repository to link since it could have been deleted.
              if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.ACTIVE) {
                throw new Error('Invalid container image')
              } else if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.INACTIVE) {
                return null;
              } else {
                // TODO: keep id of port mappings and environment variables?
                return cd;
              }
            });
            entity.containerDefinitions = containerDefinitions?.filter((c: any) => c !== null);
          });
          await Promise.all(es.map(async (entity: AwsTaskDefinition) => {
            const containerDefinitions = entity.containerDefinitions;
            if (containerDefinitions) {
              await ctx.orm.save(AwsContainerDefinition, containerDefinitions);
            }
          }));
          await ctx.orm.save(AwsTaskDefinition, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = [
            'containerDefinitions',
            'containerDefinitions.repository',
            'containerDefinitions.publicRepository',
            'containerDefinitions.logGroup'
          ];
          const opts = ids ? {
            where: {
              taskDefinitionArn: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(AwsTaskDefinition, opts);
        },
        update: async (es: AwsTaskDefinition[], ctx: Context) => {
          es.forEach((entity: AwsTaskDefinition) => {
            const containerDefinitions: any = entity?.containerDefinitions?.map(cd => {
              // For INACTIVE tasks it is not necessary to exists a ecr repository to link since it could have been deleted.
              if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.ACTIVE) {
                throw new Error('Invalid container image')
              } else if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.INACTIVE) {
                return null;
              } else {
                // TODO: handle container port mapping and env variables ids
                return cd;
              }
            });
            entity.containerDefinitions = containerDefinitions?.filter((c: any) => c !== null);
          });
          await Promise.all(es.map(async (entity: AwsTaskDefinition) => {
            const containerDefinitions = entity.containerDefinitions;
            if (containerDefinitions) {
              await ctx.orm.save(AwsContainerDefinition, containerDefinitions);
            }
          }));
          await ctx.orm.save(AwsTaskDefinition, es);
        },
        delete: (c: AwsTaskDefinition[], ctx: Context) => ctx.orm.remove(AwsTaskDefinition, c),
      }),
      cloud: new Crud({
        create: async (es: AwsTaskDefinition[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const res = [];
          for (const e of es) {
            const input: any = {
              family: e.family,
              containerDefinitions: e.containerDefinitions.map(c => {
                const container: any = { ...c };
                if (c.repository && !c.repository?.repositoryUri) {
                  throw new Error('Repository need to be created first');
                }
                if (c.publicRepository && !c.publicRepository?.repositoryUri) {
                  throw new Error('Public repository need to be created first');
                }
                container.image = `${c.repository ?
                  c.repository.repositoryUri :
                  c.publicRepository ?
                    c.publicRepository.repositoryUri :
                    c.dockerImage
                  }:${c.tag}`;
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
                container.portMappings = [{ 
                  containerPort: container.containerPort,
                  hostPort: container.hostPort,
                  protocol: container.protocol, 
                }];
                return container;
              }),
              requiresCompatibilities: ['FARGATE',],
              networkMode: 'awsvpc',
              taskRoleArn: e.taskRoleArn,
              executionRoleArn: e.executionRoleArn,
            };
            if (e.cpuMemory) {
              const [cpuStr, memoryStr] = e.cpuMemory.split('-');
              const cpu = cpuStr.split('vCPU')[0];
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
        update: async (es: AwsTaskDefinition[], ctx: Context) => {
          const res = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.TaskDefinition?.[e.taskDefinitionArn ?? ''];
            // Any change in a task definition will imply the creation of a new revision and to restore the previous value.
            const newRecord = { ...e };
            cloudRecord.id = e.id;
            cloudRecord.containerDefinitions.map((crc: AwsContainerDefinition) => {
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
        delete: async (es: AwsTaskDefinition[], ctx: Context) => {
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
    service: new Mapper<AwsService>({
      entity: AwsService,
      entityId: (e: AwsService) => e?.arn ?? '',
      entityPrint: (e: AwsService) => ({
        id: e?.id?.toString() ?? '',
        name: e?.name ?? '',
        arn: e?.arn ?? '',
        status: e?.status ?? '',
        cluster: e?.cluster?.clusterName ?? '',
        task: e?.task?.taskDefinitionArn ?? '',
        desiredCount: e?.desiredCount?.toString() ?? '',
        launchType: 'FARGATE',
        schedulingStrategy: 'REPLICA',
        network: e?.assignPublicIp ?? '',
        container: e?.containerDefinition?.name ?? '',
        targetGroup: e?.targetGroup?.targetGroupName ?? ''
      }),
      equals: (a: AwsService, b: AwsService) => Object.is(a.desiredCount, b.desiredCount)
        && Object.is(a.task?.taskDefinitionArn, b.task?.taskDefinitionArn)
        && Object.is(a.cluster?.clusterName, b.cluster?.clusterName)
        && Object.is(a.arn, b.arn)
        && Object.is(a.targetGroup?.targetGroupArn, b.targetGroup?.targetGroupArn)
        && Object.is(a.containerDefinition?.name, b.containerDefinition?.name)
        && Object.is(a.name, b.name)
        && Object.is(a.status, b.status)
        && Object.is(a?.assignPublicIp, b?.assignPublicIp)
        && Object.is(a?.securityGroups?.length, b?.securityGroups?.length)
        && (a?.securityGroups?.every(asg => !!b?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
        && Object.is(a?.subnets?.length, b?.subnets?.length)
        && (a?.subnets?.every(asn => !!b?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false),
      source: 'db',
      db: new Crud({
        create: async (es: AwsService[], ctx: Context) => {
          await Promise.all(es.map(async (entity: any) => {
            if (!entity.cluster?.id) {
              throw new Error('Clusters need to be loaded first');
            }
            if (!entity.task?.id) {
              const td = await AwsEcsFargateModule.mappers.taskDefinition.db.read(ctx, entity.task?.taskDefinitionArn);
              if (!td?.id) throw new Error('Task definitions need to be loaded first');
              entity.task.id = td.id;
            }
          }));
          console.dir({es},{depth:7})
          await ctx.orm.save(AwsService, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = [
            'cluster',
            'task',
            'securityGroups',
            'targetGroup',
            'containerDefinition',
          ];
          const opts = ids ? {
            where: {
              arn: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(AwsService, opts);
        },
        update: async (es: AwsService[], ctx: Context) => {
          await Promise.all(es.map(async (entity: any) => {
            if (!entity.cluster?.id) {
              throw new Error('Clusters need to be loaded first');
            }
            if (!entity.task?.id) {
              const td = await AwsEcsFargateModule.mappers.taskDefinition.db.read(ctx, entity.task?.taskDefinitionArn);
              if (!td?.id) throw new Error('Task definitions need to be loaded first');
              entity.task.id = td.id;
            }
          }));
          await ctx.orm.save(AwsService, es);
        },
        delete: (e: AwsService[], ctx: Context) => ctx.orm.remove(AwsService, e),
      }),
      cloud: new Crud({
        create: async (es: AwsService[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const subnets = (await client.getSubnets()).Subnets.map(s => s.SubnetId ?? '');
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
                  subnets: e.subnets?.length ? e.subnets : subnets,
                  securityGroups: e.securityGroups.map(sg => sg.groupId!),
                  assignPublicIp: e.assignPublicIp,
                }
              },
            };
            if (e.targetGroup) {
              input.loadBalancers = [{
                targetGroupArn: e.targetGroup?.targetGroupArn,
                containerName: e.containerDefinition?.name,
                containerPort: e.containerDefinition?.containerPort
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
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
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
        updateOrReplace: (prev: AwsService, next: AwsService) => {
          if (!(Object.is(prev.name, next.name)
            && Object.is(prev.cluster?.clusterArn, next.cluster?.clusterArn)
            && Object.is(prev?.assignPublicIp, next?.assignPublicIp)
            && Object.is(prev?.securityGroups?.length, next?.securityGroups?.length)
            && (prev?.securityGroups?.every(asg => !!next?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
            && Object.is(prev?.subnets?.length, next?.subnets?.length)
            && (prev?.subnets?.every(asn => !!next?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false)
            && Object.is(prev.targetGroup?.targetGroupArn, next.targetGroup?.targetGroupArn)
            && Object.is(prev.containerDefinition?.name, next.containerDefinition?.name))) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: AwsService[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const res = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Service?.[e.arn ?? ''];
            const isUpdate = AwsEcsFargateModule.mappers.service.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              // Desired count or task definition
              if (!(Object.is(e.desiredCount, cloudRecord.desiredCount) && Object.is(e.task?.taskDefinitionArn, cloudRecord.task?.taskDefinitionArn))) {
                const updatedService = await client.updateService({
                  service: e.name,
                  cluster: e.cluster?.clusterName,
                  taskDefinition: e.task?.taskDefinitionArn,
                  desiredCount: e.desiredCount,
                });
                res.push(await AwsEcsFargateModule.utils.serviceMapper(updatedService, ctx));
                continue;
              }
              // Restore values
              cloudRecord.id = e.id;
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
        delete: async (es: AwsService[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            e.desiredCount = 0;
            await client.updateService({
              service: e.name,
              cluster: e.cluster?.clusterName,
              desiredCount: e.desiredCount,
            });
            await client.deleteService(e.name, e.cluster?.clusterArn!)
          }
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEcsFargate1646390160682.prototype.up,
    preremove: awsEcsFargate1646390160682.prototype.down,
  },
});
