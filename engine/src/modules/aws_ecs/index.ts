import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import {
  AwsVpcConf,
  Cluster,
  Compatibility,
  ContainerDefinition,
  CpuMemCombination,
  EnvVariable,
  LaunchType,
  PortMapping,
  SchedulingStrategy,
  Service,
  ServiceLoadBalancer,
  TaskDefinition,
  TaskDefinitionStatus,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsAccount, AwsEcrModule, AwsElbModule, AwsSecurityGroupModule, AwsCloudwatchModule } from '..'
import { AwsLoadBalancer } from '../aws_elb/entity'
import { awsEcs1639678263049 } from './migration/1639678263049-aws_ecs'

export const AwsEcsModule: Module = new Module({
  name: 'aws_ecs',
  dependencies: ['aws_account', 'aws_ecr', 'aws_elb', 'aws_security_group', 'aws_cloudwatch',],
  provides: {
    entities: allEntities,
    tables: ['cluster', 'container_definition', 'env_variable', 'port_mapping', 'compatibility', 'task_definition', 'aws_vpc_conf', 'service', 'service_load_balancer'],
    functions: ['create_ecs_cluster', 'create_container_definition', 'create_task_definition', 'create_ecs_service'],
  },
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
      out.cpu = c?.cpu ?? null;
      // TODO: remove env var duplications
      out.environment = c.environment?.map((e: any) => {
        const e2 = new EnvVariable();
        e2.name = e.name;
        e2.value = e.value;
        return e2;
      }) ?? [];
      out.essential = c.essential ?? null;
      out.memory = c.memory ?? null;
      out.memoryReservation = c.memoryReservation ?? null;
      out.name = c.name;
      // TODO: remove port mapping duplications
      out.portMappings = c.portMappings?.map((pm: any) => {
        const pm2 = new PortMapping();
        pm2.containerPort = pm.containerPort;
        pm2.hostPort = pm.hostPort;
        pm2.protocol = pm.protocol;
        return pm2;
      }) ?? [];
      const imageTag = c.image?.split(':');
      if (imageTag[0]?.includes('amazonaws.com')) {
        const repositories = ctx.memo?.db?.AwsRepository ? Object.values(ctx.memo?.db?.AwsRepository) : await AwsEcrModule.mappers.repository.db.read(ctx);
        const repository = repositories.find((r: any) => r.repositoryUri === imageTag[0]);
        out.repository = repository;
        out.dockerImage = imageTag[-1] ?? null;
        out.publicRepository = imageTag[-1] ?? null;
      } else if (imageTag[0]?.includes('public.ecr.aws')) {
        const publicRepositories = ctx.memo?.db?.AwsPublicRepository ? Object.values(ctx.memo?.db?.AwsPublicRepository) : await AwsEcrModule.mappers.publicRepository.db.read(ctx);
        const publicRepository = publicRepositories.find((r: any) => r.repositoryUri === imageTag[0]);
        out.publicRepository = publicRepository;
        out.dockerImage = imageTag[-1] ?? null;
        out.repository = imageTag[-1] ?? null;
      } else {
        out.dockerImage = imageTag[0];
        out.repository = imageTag[-1] ?? null;
        out.publicRepository = imageTag[-1] ?? null;
      }
      out.tag = imageTag[1] ?? null;
      // TODO: eventually handle more log drivers
      if (c.logConfiguration?.logDriver === 'awslogs') {
        const groupName = c.logConfiguration.options['awslogs-group'];
        const logGroups = ctx.memo?.db?.LogGroup ? Object.values(ctx.memo?.db?.LogGroup) : await AwsCloudwatchModule.mappers.logGroup.db.read(ctx);
        const logGroup = logGroups.find((lg: any) => lg.logGroupName === groupName);
        out.logGroup = logGroup;
      }
      if (!out.logGroup) out.logGroup = c.logConfiguration?.undefinedprop ?? null;
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new TaskDefinition();
      out.containers = await Promise.all(td.containerDefinitions.map(async (tdc: any) => {
        const cd = await AwsEcsModule.utils.containerDefinitionMapper(tdc, ctx);
        // For INACTIVE tasks it is not necessary to exists a cloud watch log group to link since it could have been deleted.
        if (!!tdc?.logConfiguration?.options?.['awslogs-group'] && !cd?.logGroup && td.status === TaskDefinitionStatus.ACTIVE) {
          throw new Error('Cloudwatch log groups need to be loaded first')
        }
        return cd;
      }));
      out.cpuMemory = `${+(td.cpu ?? '256') / 1024}vCPU-${+(td.memory ?? '512') / 1024}GB` as CpuMemCombination;
      out.executionRoleArn = td.executionRoleArn ?? null;
      out.family = td.family;
      out.networkMode = td.networkMode ?? null;
      out.reqCompatibilities = await Promise.all(td.requiresCompatibilities?.map(async (rc: any) => {
        const comp = await ctx.orm.findOne(Compatibility, {
          where: {
            name: rc,
          },
        });
        if (!comp) {
          const rc2 = new Compatibility();
          rc2.name = rc;
          return rc2;
        }
        return comp;
      }) ?? []);
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      out.taskRoleArn = td.taskRoleArn ?? null;
      return out;
    },
    serviceMapper: async (s: any, ctx: Context) => {
      const out = new Service();
      out.arn = s.serviceArn;
      if (s.clusterArn) {
        // try to retrieve cluster from db
        let cluster = await ctx.orm.findOne(Cluster, { where: { clusterArn: s.clusterArn } });
        if (!cluster) {
          // If not, try from cloud. The cluster could be in a deleting process and we still need some cluster properties to perform the delete action.
          cluster = await AwsEcsModule.mappers.cluster.cloud.read(ctx, s.clusterArn);
        }
        out.cluster = cluster;
      }
      out.desiredCount = s.desiredCount;
      out.launchType = s.launchType as LaunchType;
      out.loadBalancers = await Promise.all(s.loadBalancers?.map(async (slb: any) => {
        const slb2 = new ServiceLoadBalancer();
        slb2.containerName = slb.containerName;
        slb2.containerPort = slb.containerPort;
        if (slb.loadBalancerName) {
          const loadBalancers = ctx.memo?.db?.AwsLoadBalancer ? Object.values(ctx.memo?.db?.AwsLoadBalancer) : await AwsElbModule.mappers.loadBalancer.db.read(ctx);
          slb2.elb = loadBalancers.find((lb: AwsLoadBalancer) => lb.loadBalancerName === slb.loadBalancerName);
        }
        if (slb.targetGroupArn) {
          const targetGroups = ctx.memo?.db?.AwsTargetGroup ? Object.values(ctx.memo?.db?.AwsTargetGroup) : await AwsElbModule.mappers.targetGroup.db.read(ctx);
          const targetGroup = targetGroups.find((tg: any) => tg.targetGroupArn === slb.targetGroupArn);
          if (targetGroup?.targetGroupArn) {
            slb2.targetGroup = targetGroup;
          } else {
            throw new Error('Target groups need to be loaded first')
          }
        }
        return slb2;
      }) ?? []);
      out.name = s.serviceName;
      if (s.networkConfiguration?.awsvpcConfiguration) {
        const networkConf = s.networkConfiguration.awsvpcConfiguration;
        const awsVpcConf = new AwsVpcConf();
        awsVpcConf.assignPublicIp = networkConf.assignPublicIp;
        const securityGroups = ctx.memo?.db?.AwsSecurityGroup ? Object.values(ctx.memo?.db?.AwsSecurityGroup) : await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx);
        awsVpcConf.securityGroups = networkConf.securityGroups?.map((sg: string) => {
          const securityGroup = securityGroups.find((g: any) => g.groupId === sg);
          if (!securityGroup) throw new Error('Security groups need to be loaded first');
          return securityGroup;
        }) ?? [];
        awsVpcConf.subnets = await Promise.all(networkConf.subnets?.map(async (sn: string) =>
          ctx.memo?.db?.AwsSubnets?.[sn] ?? await AwsAccount.mappers.subnet.db.read(ctx, sn)) ?? []);
        out.network = awsVpcConf;
      }
      out.schedulingStrategy = s.schedulingStrategy as SchedulingStrategy;
      out.status = s.status;
      if (s.taskDefinition) {
        const taskDefinitions = ctx.memo?.cloud?.TaskDefinition ? Object.values(ctx.memo?.cloud?.TaskDefinition) : await AwsEcsModule.mappers.taskDefinition.cloud.read(ctx);
        const taskDefinition = taskDefinitions.find((t: any) => t.taskDefinitionArn === s.taskDefinition);
        if (!taskDefinition) throw new Error('Task definitions need to be loaded first');
        out.task = taskDefinition;
      }
      return out;
    },
    containersEq: (a: ContainerDefinition, b: ContainerDefinition) => Object.is(a.cpu, b.cpu)
      && Object.is(a.dockerImage, b.dockerImage)
      && Object.is(a.environment?.length, b.environment?.length)
      && a.environment?.every(ae => !!b.environment?.find(be => Object.is(ae.name, be.name) && Object.is(ae.value, be.value)))
      && Object.is(a.essential, b.essential)
      && AwsCloudwatchModule.mappers.logGroup.equals(a.logGroup, b.logGroup)
      && Object.is(a.memory, b.memory)
      && Object.is(a.memoryReservation, b.memoryReservation)
      && Object.is(a.name, b.name)
      && Object.is(a.portMappings?.length, b.portMappings?.length)
      && a.portMappings?.every(apm => !!b.portMappings?.find(
        bpm => Object.is(apm.hostPort, bpm.hostPort) && Object.is(apm.containerPort, bpm.containerPort) && Object.is(apm.protocol, bpm.protocol)))
      && Object.is(a.publicRepository?.repositoryName, b.publicRepository?.repositoryName)
      && Object.is(a.repository?.repositoryName, b.repository?.repositoryName)
      && Object.is(a.tag, b.tag),
    serviceNetworkEq: (a: AwsVpcConf, b: AwsVpcConf) => Object.is(a?.assignPublicIp, b?.assignPublicIp)
      && Object.is(a?.securityGroups?.length, b?.securityGroups?.length)
      && (a?.securityGroups?.every(asg => !!b?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
      && Object.is(a?.subnets?.length, b?.subnets?.length)
      && (a?.subnets?.every(asn => !!b?.subnets?.find(bsn => Object.is(asn.subnetId, bsn.subnetId))) ?? false),
  },
  mappers: {
    cluster: new Mapper<Cluster>({
      entity: Cluster,
      entityId: (e: Cluster) => e?.clusterArn ?? 'default',
      entityPrint: (e: Cluster) => ({
        id: e?.id?.toString() ?? '',
        clusterName: e?.clusterName ?? '',
        clusterArn: e?.clusterArn ?? '',
        clusterStatus: e?.clusterStatus ?? '',
      }),
      equals: (a: Cluster, b: Cluster) => Object.is(a.clusterArn, b.clusterArn)
        && Object.is(a.clusterName, b.clusterName)
        && Object.is(a.clusterStatus, b.clusterStatus),
      source: 'db',
      db: new Crud({
        create: (c: Cluster[], ctx: Context) => ctx.orm.save(Cluster, c),
        read: async (ctx: Context, ids?: string[]) => ctx.orm.find(Cluster, ids ? {
          where: {
            clusterArn: In(ids),
          },
        } : undefined),
        update: (c: Cluster[], ctx: Context) => ctx.orm.save(Cluster, c),
        delete: (c: Cluster[], ctx: Context) => ctx.orm.remove(Cluster, c),
      }),
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
            const newEntity = await AwsEcsModule.utils.clusterMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcsModule.mappers.cluster.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const clusters = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getCluster(id))) :
            await client.getClusters() ?? [];
          return await Promise.all(clusters.map(c => AwsEcsModule.utils.clusterMapper(c, ctx)));
        },
        updateOrReplace: (prev: Cluster, next: Cluster) => {
          if (!Object.is(prev.clusterName, next.clusterName)) return 'replace';
          return 'update';
        },
        update: async (es: Cluster[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Cluster?.[e.clusterArn ?? ''];
            const isUpdate = AwsEcsModule.mappers.cluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              cloudRecord.id = e.id;
              await AwsEcsModule.mappers.cluster.db.update(cloudRecord, ctx);
              return cloudRecord;
            } else {
              // We need to delete the current cloud record and create the new one.
              // The id in database will be the same `e` will keep it.
              await AwsEcsModule.mappers.cluster.cloud.delete(cloudRecord, ctx);
              return await AwsEcsModule.mappers.cluster.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (es: Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async e => {
            if (e.clusterStatus === 'INACTIVE' && e.clusterName === 'default') {
              const dbCluster = await AwsEcsModule.mappers.cluster.db.read(ctx, e.clusterArn);
              // Temporarily create again the default inactive cluster if deleted from DB to avoid infinite loops.
              if (!dbCluster) {
                await AwsEcsModule.mappers.cluster.db.create(e, ctx);
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
      entityId: (e: TaskDefinition) => e?.taskDefinitionArn ?? '',
      entityPrint: (e: TaskDefinition) => ({
        id: e?.id?.toString() ?? '',
        taskDefinitionArn: e?.taskDefinitionArn ?? '',
        containers: e?.containers?.map(c => c?.name ?? '').join(', ') ?? '',
        family: e?.family ?? '',
        revision: e?.revision?.toString() ?? '',
        taskRoleArn: e?.taskRoleArn ?? '',
        executionRoleArn: e?.executionRoleArn ?? '',
        networkMode: e?.networkMode ?? '',
        status: e?.status ?? TaskDefinitionStatus.ACTIVE, // TODO: Which?
        reqCompatibilities: e?.reqCompatibilities?.map(c => c?.name ?? '').join(', ') ?? '',
        cpuMemory: e?.cpuMemory ?? CpuMemCombination['1vCPU-2GB'], // TODO: Which?
      }),
      equals: (a: TaskDefinition, b: TaskDefinition) => Object.is(a.cpuMemory, b.cpuMemory)
        && Object.is(a.executionRoleArn, b.executionRoleArn)
        && Object.is(a.family, b.family)
        && Object.is(a.networkMode, b.networkMode)
        && Object.is(a.reqCompatibilities?.length, b.reqCompatibilities?.length)
        && (a.reqCompatibilities?.every(arc => !!b.reqCompatibilities?.find(brc => Object.is(arc.name, brc.name))) ?? false)
        && Object.is(a.revision, b.revision)
        && Object.is(a.status, b.status)
        && Object.is(a.taskDefinitionArn, b.taskDefinitionArn)
        && Object.is(a.taskRoleArn, b.taskRoleArn)
        && (a.status === TaskDefinitionStatus.ACTIVE && b.status === TaskDefinitionStatus.ACTIVE ? Object.is(a.containers.length, b.containers.length)
          && a.containers.every(ac => !!b.containers.find(bc => AwsEcsModule.utils.containersEq(ac, bc))) : true),
      source: 'db',
      db: new Crud({
        create: async (es: TaskDefinition[], ctx: Context) => {
          // Deduplicate Compatibility ahead of time, preserving an ID if it exists
          const compatibilities: { [key: string]: Compatibility, } = {};
          es.forEach((entity: TaskDefinition) => {
            if (entity.reqCompatibilities) {
              entity.reqCompatibilities.forEach(rc => {
                const name: any = rc.name;
                compatibilities[name] = compatibilities[name] ?? rc;
                if (rc.id) compatibilities[name].id = rc.id;
                rc = compatibilities[name];
              })
            }
            const containers: any = entity?.containers?.map(cd => {
              // For INACTIVE tasks it is not necessary to exists a ecr repository to link since it could have been deleted.
              if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.ACTIVE) {
                throw new Error('Invalid container image')
              } else if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.INACTIVE) {
                return null;
              } else {
                return cd;
              }
            });
            entity.containers = containers?.filter((c: any) => c !== null);
          });
          await ctx.orm.save(Compatibility, Object.values(compatibilities));
          await Promise.all(es.map(async (entity: TaskDefinition) => {
            if (entity.containers) {
              await ctx.orm.save(ContainerDefinition, entity.containers);
            }
          }));
          const savedCompatibilities = await ctx.orm.find(Compatibility);
          es.forEach(entity => {
            if (entity.reqCompatibilities?.length) {
              entity.reqCompatibilities.forEach(rc => {
                const c = savedCompatibilities.find((sc: any) => sc.name === rc.name);
                if (!c.id) throw new Error('Compatibilities need to be loaded first');
                rc.id = c.id;
              })
            }
          });
          await ctx.orm.save(TaskDefinition, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = [
            'reqCompatibilities',
            'containers',
            'containers.portMappings',
            'containers.environment',
            'containers.repository',
            'containers.publicRepository',
            'containers.logGroup'
          ];
          const opts = ids ? {
            where: {
              taskDefinitionArn: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(TaskDefinition, opts);
        },
        update: async (es: TaskDefinition[], ctx: Context) => {
          // Deduplicate Compatibility ahead of time, preserving an ID if it exists
          const compatibilities: { [key: string]: Compatibility, } = {};
          es.forEach((entity: TaskDefinition) => {
            if (entity.reqCompatibilities) {
              entity.reqCompatibilities.forEach(rc => {
                const name: any = rc.name;
                compatibilities[name] = compatibilities[name] ?? rc;
                if (rc.id) compatibilities[name].id = rc.id;
                rc = compatibilities[name];
              })
            }
            const containers: any = entity?.containers?.map(cd => {
              // For INACTIVE tasks it is not necessary to exists a ecr repository to link since it could have been deleted.
              if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.ACTIVE) {
                throw new Error('Invalid container image')
              } else if (!cd?.repository && !cd?.publicRepository && !cd?.dockerImage && entity.status === TaskDefinitionStatus.INACTIVE) {
                return null;
              } else {
                return cd;
              }
            });
            entity.containers = containers?.filter((c: any) => c !== null);
          });
          await ctx.orm.save(Compatibility, Object.values(compatibilities));
          await Promise.all(es.map(async (entity: TaskDefinition) => {
            if (entity.containers) {
              await ctx.orm.save(ContainerDefinition, entity.containers);
            }
          }));
          await ctx.orm.save(TaskDefinition, es);
        },
        delete: (c: TaskDefinition[], ctx: Context) => ctx.orm.remove(TaskDefinition, c),
      }),
      cloud: new Crud({
        create: async (es: TaskDefinition[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const input: any = {
              family: e.family,
              containerDefinitions: e.containers.map(c => {
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
                return container;
              }),
              requiresCompatibilities: e.reqCompatibilities?.map(c => c.name!) ?? [],
              networkMode: e.networkMode,
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
            const newEntity = await AwsEcsModule.utils.taskDefinitionMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Keep container definition ids to avoid duplicates
            e.containers?.forEach(c => {
              newEntity?.containers?.forEach((nc: any) => {
                if (nc.name === c.name) {
                  nc.id = c.id;
                }
              })
            });
            // Save the record back into the database to get the new fields updated
            await AwsEcsModule.mappers.taskDefinition.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const taskDefs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getTaskDefinition(id))) :
            (await client.getTaskDefinitions()).taskDefinitions ?? [];
          return await Promise.all(taskDefs.map(
            td => AwsEcsModule.utils.taskDefinitionMapper(td, ctx)
          ));
        },
        updateOrReplace: () => 'update',
        update: async (es: TaskDefinition[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.TaskDefinition?.[e.taskDefinitionArn ?? ''];
            // Any change in a task definition will imply the creation of a new revision and to restore the previous value.
            const newRecord = { ...e };
            cloudRecord.id = e.id;
            newRecord.id = undefined;
            newRecord.taskDefinitionArn = '';
            newRecord.containers = newRecord.containers.map(c => {
              c.id = undefined;
              return c;
            })
            await AwsEcsModule.mappers.taskDefinition.db.create(newRecord, ctx);
            await AwsEcsModule.mappers.taskDefinition.db.update(cloudRecord, ctx);
            return cloudRecord;
          }));
        },
        delete: async (es: TaskDefinition[], ctx: Context) => {
          // Do not delete task if it is being used by a service
          const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsModule.mappers.service.cloud.read(ctx);
          const client = await ctx.getAwsClient() as AWS;
          const esWithServiceAttached = [];
          const esToDelete = [];
          for (const e of es) {
            if (Object.values(services).find((s: any) => s.task?.taskDefinitionArn === e.taskDefinitionArn)) {
              esWithServiceAttached.push(e);
            } else {
              if (e.status === 'INACTIVE') {
                const dbTd = await AwsEcsModule.mappers.taskDefinition.db.read(ctx, e.taskDefinitionArn);
                // Temporarily create again the task definition inactive if deleted from DB to avoid infinite loops.
                // ? Eventually, forbid task definitons to be deleted from database.
                if (!dbTd) {
                  await AwsEcsModule.mappers.taskDefinition.db.create(e, ctx);
                }
              } else {
                esToDelete.push(e)
              }
            }
          };
          await Promise.all(esToDelete.map(e => client.deleteTaskDefinition(e.taskDefinitionArn!)));
          if (esWithServiceAttached.length) {
            throw new Error('Some tasks could not be deleted. They are attached to an existing service.')
          }
        },
      }),
    }),
    service: new Mapper<Service>({
      entity: Service,
      entityId: (e: Service) => e?.arn ?? '',
      entityPrint: (e: Service) => ({
        id: e?.id?.toString() ?? '',
        name: e?.name ?? '',
        arn: e?.arn ?? '',
        status: e?.status ?? '',
        cluster: e?.cluster?.clusterName ?? '',
        task: e?.task?.taskDefinitionArn ?? '',
        desiredCount: e?.desiredCount?.toString() ?? '',
        launchType: e?.launchType ?? LaunchType.EC2, // TODO: Which?
        schedulingStrategy: e?.schedulingStrategy ?? SchedulingStrategy.REPLICA, // TODO: Which?
        network: e?.network?.assignPublicIp ?? '',
        loadBalancers: e?.loadBalancers?.map(lb => lb.elb?.loadBalancerName ?? '').join(', ') ?? '',
      }),
      equals: (a: Service, b: Service) => Object.is(a.desiredCount, b.desiredCount)
        && Object.is(a.task?.taskDefinitionArn, b.task?.taskDefinitionArn)
        && Object.is(a.cluster?.clusterName, b.cluster?.clusterName)
        && Object.is(a.arn, b.arn)
        && Object.is(a.launchType, b.launchType)
        && Object.is(a.loadBalancers?.length, b.loadBalancers?.length)
        && (a.loadBalancers?.every(alb => !!b.loadBalancers?.find(blb => Object.is(alb.elb?.loadBalancerArn, blb.elb?.loadBalancerArn))) ?? false)
        && Object.is(a.name, b.name)
        && AwsEcsModule.utils.serviceNetworkEq(a.network, b.network)
        && Object.is(a.schedulingStrategy, b.schedulingStrategy)
        && Object.is(a.status, b.status),
      source: 'db',
      db: new Crud({
        create: async (es: Service[], ctx: Context) => {
          await Promise.all(es.map(async (entity: any) => {
            if (!entity.cluster?.id) {
              throw new Error('Clusters need to be loaded first');
            }
            if (!entity.task?.id) {
              const td = await AwsEcsModule.mappers.taskDefinition.db.read(ctx, entity.task?.taskDefinitionArn);
              if (!td?.id) throw new Error('Task definitions need to be loaded first');
              entity.task.id = td.id;
            }
          }));
          await ctx.orm.save(Service, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          const relations = [
            'cluster',
            'task',
            'network',
            'network.subnets',
            'network.securityGroups',
            'loadBalancers',
            'loadBalancers.targetGroup',
            'loadBalancers.elb',
          ];
          const opts = ids ? {
            where: {
              arn: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(Service, opts);
        },
        update: async (es: Service[], ctx: Context) => {
          await Promise.all(es.map(async (entity: any) => {
            if (!entity.cluster?.id) {
              throw new Error('Clusters need to be loaded first');
            }
            if (!entity.task?.id) {
              const td = await AwsEcsModule.mappers.taskDefinition.db.read(ctx, entity.task?.taskDefinitionArn);
              if (!td?.id) throw new Error('Task definitions need to be loaded first');
              entity.task.id = td.id;
            }
          }));
          await ctx.orm.save(Service, es);
        },
        delete: (e: Service[], ctx: Context) => ctx.orm.remove(Service, e),
      }),
      cloud: new Crud({
        create: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const input: any = {
              serviceName: e.name,
              taskDefinition: e.task?.taskDefinitionArn,
              launchType: e.launchType,
              cluster: e.cluster?.clusterName,
              schedulingStrategy: e.schedulingStrategy,
              desiredCount: e.desiredCount,
            };
            if (e.network) {
              input.networkConfiguration = {
                awsvpcConfiguration: {
                  subnets: e.network.subnets.map(sn => sn.subnetId!),
                  securityGroups: e.network.securityGroups.map(sg => sg.groupId!),
                  assignPublicIp: e.network.assignPublicIp,
                }
              }
            }
            if (e.loadBalancers?.length) {
              input.loadBalancers = e.loadBalancers.map(lb => ({
                targetGroupArn: lb.targetGroup?.targetGroupArn,
                loadBalancerName: lb.elb?.loadBalancerName,
                containerName: lb.containerName,
                containerPort: lb.containerPort
              }));
            }
            const result = await client.createService(input);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('serviceName') || !result?.hasOwnProperty('clusterArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getService(result.serviceName!, result.clusterArn!);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcsModule.utils.serviceMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcsModule.mappers.service.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          // TODO: Refactor this. I don't think the `ids` branch has been tested, either. So I don't want to touch it
          if (ids) {
            return await Promise.all(ids.map(async (id) => {
              const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsModule.mappers.service.cloud.read(ctx);
              const service = services.find((s: any) => s.name === id);
              return await AwsEcsModule.utils.serviceMapper(
                await client.getService(id, service.cluster.clusterArn), ctx
              );
            }));
          } else {
            const clusters = ctx.memo?.cloud?.Cluster ? Object.values(ctx.memo?.cloud?.Cluster) : await AwsEcsModule.mappers.cluster.cloud.read(ctx);
            const result = await client.getServices(clusters?.map((c: any) => c.clusterArn) ?? []);
            return await Promise.all(result.map(async (s) => AwsEcsModule.utils.serviceMapper(s, ctx)));
          }
        },
        update: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const updatedService = await client.updateService({
              service: e.name,
              taskDefinition: e.task?.taskDefinitionArn,
              cluster: e.cluster?.clusterName,
              desiredCount: e.desiredCount,
            });
            return AwsEcsModule.utils.serviceMapper(updatedService, ctx);
          }));
        },
        delete: async (es: Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async e => {
            e.desiredCount = 0;
            await AwsEcsModule.mappers.service.cloud.update(e, ctx);
            return client.deleteService(e.name, e.cluster?.clusterArn!)
          }));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEcs1639678263049.prototype.up,
    preremove: awsEcs1639678263049.prototype.down,
  },
});
