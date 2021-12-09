import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import {
  AwsVpcConf,
  Cluster,
  Compatibility,
  Container,
  CpuMemCombination,
  EnvVariable,
  LaunchType,
  PortMapping,
  SchedulingStrategy,
  Service,
  ServiceLoadBalancer,
  TaskDefinition,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcs1637756035104, } from './migration/1637756035104-aws_ecs'
import { AwsAccount, AwsEcrModule, AwsElbModule, AwsSecurityGroupModule } from '..'
import { AwsLoadBalancer } from '../aws_elb/entity'

export const AwsEcsModule: Module = new Module({
  name: 'aws_ecs',
  dependencies: ['aws_account', 'aws_ecr', 'aws_elb', 'aws_security_group',],
  provides: {
    entities: allEntities,
    tables: ['cluster', 'container', 'env_variable', 'port_mapping', 'compatibility', 'task_definition', 'aws_vpc_conf', 'service', 'service_load_balancer'],
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
    containerMapper: async (c: any, ctx: Context) => {
      const out = new Container();
      out.cpu = c?.cpu;
      out.environment = c.environment?.map((e: any) => {
        const e2 = new EnvVariable();
        e2.name = e.name;
        e2.value = e.value;
        return e2;
      }) ?? [];
      out.essential = c.essential;
      out.memory = c.memory;
      out.memoryReservation = c.memoryReservation;
      out.name = c.name;
      out.portMappings = c.portMappings?.map((pm: any) => {
        const pm2 = new PortMapping();
        pm2.containerPort = pm.containerPort;
        pm2.hostPort = pm.hostPort;
        pm2.protocol = pm.protocol;
        return pm2;
      }) ?? [];
      const imageTag = c.image?.split(':');
      if (!imageTag[0]?.includes('amazonaws.com')) {
        out.dockerImage = imageTag[0];
      } else {
        const repositories = ctx.memo?.db?.AwsRepository ? Object.values(ctx.memo?.db?.AwsRepository) : await AwsEcrModule.mappers.repository.db.read(ctx);
        const repository = repositories.find((r: any) => r.repositoryUri === imageTag[0]);
        if (!repository) return null;
        out.repository = repository;
      }
      out.tag = imageTag[1];
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new TaskDefinition();
      const containers: Container[] = await Promise.all(td.containerDefinitions.map(async (tdc: any) => {
        const container = await ctx.orm.findOne(Container, {
          where: {
            name: tdc.name,
          },
        });
        if (!container) return AwsEcsModule.utils.containerMapper(tdc, ctx);
        return container;
      }));
      out.containers = containers.filter(c => c !== null);
      out.cpuMemory = `${+(td.cpu ?? '256') / 1024}vCPU-${+(td.memory ?? '512') / 1024}GB` as CpuMemCombination;
      out.executionRoleArn = td.executionRoleArn;
      out.family = td.family;
      out.networkMode = td.networkMode;
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
      out.taskRoleArn = td.taskRoleArn;
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
          // TODO: Work around using `ctx.orm.find` to avoid temporal memo empty objects.
          const targetGroup = ctx.memo?.db?.AwsTargetGroup?.[slb.targetGroupArn] ?? await AwsElbModule.mappers.targetGroup.db.read(ctx, slb.targetGroupArn);
          if (targetGroup?.targetGroupArn) {
            slb2.targetGroup = targetGroup;
          } else {
            if (ctx.memo?.db?.AwsTargetGroup?.[slb.targetGroupArn]) {
              delete ctx.memo.db.AwsTargetGroup[slb.targetGroupArn];
            }
          }
        }
        return slb2;
      }) ?? []);
      out.name = s.serviceName;
      if (s.networkConfiguration?.awsvpcConfiguration) {
        const networkConf = s.networkConfiguration.awsvpcConfiguration;
        const awsVpcConf = new AwsVpcConf();
        awsVpcConf.assignPublicIp = networkConf.assignPublicIp;
        awsVpcConf.securityGroups = await Promise.all(networkConf.securityGroups?.map(async (sg: string) =>
          ctx.memo?.db?.AwsSecurityGroup?.[sg] ?? await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg)) ?? []);
        awsVpcConf.subnets = await Promise.all(networkConf.subnets?.map(async (sn: string) =>
          ctx.memo?.db?.AwsSubnets?.[sn] ?? await AwsAccount.mappers.subnet.db.read(ctx, sn)) ?? []);
        out.network = awsVpcConf;
      }
      out.schedulingStrategy = s.schedulingStrategy as SchedulingStrategy;
      out.status = s.status;
      if (s.taskDefinition) {
        out.task = ctx.memo?.cloud?.TaskDefinition?.[s.taskDefinition] ?? await AwsEcsModule.mappers.taskDefinition.cloud.read(ctx, s.taskDefinition);
      }
      return out;
    },
  },
  mappers: {
    cluster: new Mapper<Cluster>({
      entity: Cluster,
      entityId: (e: Cluster) => e?.clusterArn ?? 'default',
      equals: (_a: Cluster, _b: Cluster) => true,  // TODO: Fill in when updates supported
      source: 'db',
      db: new Crud({
        create: async (c: Cluster | Cluster[], ctx: Context) => { await ctx.orm.save(Cluster, c); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const opts = id ? {
            where: {
              clusterArn: Array.isArray(id) ? In(id) : id,
            },
          } : undefined;
          return (!id || Array.isArray(id)) ? await ctx.orm.find(Cluster, opts) : await ctx.orm.findOne(Cluster, opts);
        },
        update: async (c: Cluster | Cluster[], ctx: Context) => { await ctx.orm.save(Cluster, c); },
        delete: async (c: Cluster | Cluster[], ctx: Context) => { await ctx.orm.remove(Cluster, c); },
      }),
      cloud: new Crud({
        create: async (c: Cluster | Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(c) ? c : [c];
          const out = await Promise.all(es.map(async (e) => {
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
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(c)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsEcsModule.utils.clusterMapper(
                  await client.getCluster(id), ctx
                );
              }));
            } else {
              return await AwsEcsModule.utils.clusterMapper(
                await client.getCluster(ids), ctx
              );
            }
          } else {
            const clusters = await client.getClusters() ?? [];
            return await Promise.all(clusters.map(async (c: any) => {
              return await AwsEcsModule.utils.clusterMapper(c, ctx);
            }));
          }
        },
        update: async (_c: Cluster | Cluster[], _ctx: Context) => { throw new Error('tbd'); },
        delete: async (c: Cluster | Cluster[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(c) ? c : [c];
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
      equals: (_a: TaskDefinition, _b: TaskDefinition) => true,  // TODO: Fill in when updates supported
      source: 'db',
      db: new Crud({
        create: async (e: TaskDefinition | TaskDefinition[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          // Deduplicate Compatibility ahead of time, preserving an ID if it exists
          const compatibilities: { [key: string]: Compatibility, } = {};
          const containers: { [key: string]: Container, } = {};
          es.forEach((entity: TaskDefinition) => {
            if (entity.reqCompatibilities) {
              entity.reqCompatibilities.forEach(rc => {
                const name: any = rc.name;
                compatibilities[name] = compatibilities[name] ?? rc;
                if (rc.id) compatibilities[name].id = rc.id;
                rc = compatibilities[name];
              })
            }
            if (entity.containers) {
              entity.containers.forEach(c => {
                const name: any = c.name;
                containers[name] = containers[name] ?? c;
                if (c.id) containers[name].id = c.id;
                c = containers[name];
              })
            }
          });
          await ctx.orm.save(Compatibility, Object.values(compatibilities));
          await ctx.orm.save(Container, Object.values(containers));
          const savedContainers = await ctx.orm.find(Container);
          const savedCompatibilities = await ctx.orm.find(Compatibility);
          es.forEach(entity => {
            if (entity.containers?.length) {
              entity.containers.forEach(ec => {
                const c = savedContainers.find((sc: any) => sc.name === ec.name);
                if (!c.id) throw new Error('Container need to be loaded first');
                ec.id = c.id;
              })
            }
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
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['reqCompatibilities', 'containers', 'containers.portMappings', 'containers.environment', 'containers.repository'];
          const opts = id ? {
            where: {
              taskDefinitionArn: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(TaskDefinition, opts) : await ctx.orm.findOne(TaskDefinition, opts);
        },
        update: async (e: TaskDefinition | TaskDefinition[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
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
          });
          await ctx.orm.save(Compatibility, Object.values(compatibilities));
          es.map(async (entity: TaskDefinition) => {
            if (entity.containers) {
              await ctx.orm.save(Container, entity.containers);
            }
          });
          await ctx.orm.save(TaskDefinition, es);
        },
        delete: async (c: TaskDefinition | TaskDefinition[], ctx: Context) => { await ctx.orm.remove(TaskDefinition, c); },
      }),
      cloud: new Crud({
        create: async (td: TaskDefinition | TaskDefinition[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(td) ? td : [td];
          const out = await Promise.all(es.map(async (e) => {
            const input: any = {
              family: e.family,
              containerDefinitions: e.containers.map(c => {
                const container: any = { ...c };
                if (c.repository && !c.repository?.repositoryUri) throw new Error('Repository need to be created first');
                container.image = `${c.repository ? c.repository.repositoryUri : c.dockerImage}:${c.tag}`;
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
            // Save the record back into the database to get the new fields updated
            await AwsEcsModule.mappers.taskDefinition.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(td)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsEcsModule.utils.taskDefinitionMapper(
                  await client.getTaskDefinition(id), ctx
                );
              }));
            } else {
              return await AwsEcsModule.utils.taskDefinitionMapper(
                await client.getTaskDefinition(ids), ctx
              );
            }
          } else {
            const result = await client.getTaskDefinitions();
            return await Promise.all(result.taskDefinitions.map(async (td: any) => await AwsEcsModule.utils.taskDefinitionMapper(td, ctx)));
          }
        },
        update: async (_td: TaskDefinition | TaskDefinition[], _ctx: Context) => { throw new Error('Cannot update task definitions. Create a new revision'); },
        delete: async (td: TaskDefinition | TaskDefinition[], ctx: Context) => {
          // Do not delete task if it is being used by a service
          const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsModule.mappers.service.cloud.read(ctx);
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(td) ? td : [td];
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
      equals: (a: Service, b: Service) => Object.is(a.desiredCount, b.desiredCount)
        && Object.is(a.task?.taskDefinitionArn, b.task?.taskDefinitionArn)
        && Object.is(a.cluster?.clusterName, b.cluster?.clusterName),
      source: 'db',
      db: new Crud({
        create: async (e: Service | Service[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
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
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['cluster', 'task', 'network', 'network.subnets', 'network.securityGroups', 'loadBalancers', 'loadBalancers.targetGroup', 'loadBalancers.elb',];
          const opts = id ? {
            where: {
              arn: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(Service, opts) : await ctx.orm.findOne(Service, opts);
        },
        update: async (e: Service | Service[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
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
        delete: async (e: Service | Service[], ctx: Context) => { await ctx.orm.remove(Service, e); },
      }),
      cloud: new Crud({
        create: async (s: Service | Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(s) ? s : [s];
          const out = await Promise.all(es.map(async (e) => {
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
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(s)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsModule.mappers.serivce.cloud.read(ctx);
                const service = services.find((s: any) => s.name === id);
                return await AwsEcsModule.utils.serviceMapper(
                  await client.getService(id, service.cluster.clusterArn), ctx
                );
              }));
            } else {
              const services = ctx.memo?.cloud?.Service ? Object.values(ctx.memo?.cloud?.Service) : await AwsEcsModule.mappers.serivce.cloud.read(ctx);
              const service = services.find((s: any) => s.name === ids);
              return await AwsEcsModule.utils.serviceMapper(
                await client.getService(ids, service.cluster.clusterArn), ctx
              );
            }
          } else {
            const clusters = ctx.memo?.cloud?.Cluster ? Object.values(ctx.memo?.cloud?.Cluster) : await AwsEcsModule.mappers.cluster.cloud.read(ctx);
            const result = await client.getServices(clusters?.map((c: any) => c.clusterArn) ?? []);
            return await Promise.all(result.map(async (s) => AwsEcsModule.utils.serviceMapper(s, ctx)));
          }
        },
        update: async (s: Service | Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(s) ? s : [s];
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
        delete: async (s: Service | Service[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(s) ? s : [s];
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
    postinstall: awsEcs1637756035104.prototype.up,
    preremove: awsEcs1637756035104.prototype.down,
  },
});
