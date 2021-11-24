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
import { awsEcs1637669736785, } from './migration/1637669736785-aws_ecs'
import { AwsAccount, AwsEcrModule, AwsElbModule, AwsSecurityGroupModule } from '..'
import { AwsLoadBalancer } from '../aws_elb/entity'

export const AwsEcsModule: Module = new Module({
  name: 'aws_ecs',
  dependencies: ['aws_account', 'aws_ecr', 'aws_elb', 'aws_security_group',],
  provides: {
    entities: allEntities,
    tables: ['cluster',],
    functions: ['create_ecs_cluster', 'create_container_definition', 'create_task_definition',],
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
        out.tag = imageTag[1];
      } else {
        const repositories = ctx.memo?.db?.AwsRepository ? Object.values(ctx.memo?.db?.AwsRepository) : await AwsEcrModule.mappers.repository.db.read(ctx);
        out.repository = repositories.find((r: any) => r.repositoryUri === imageTag[0]);
        out.tag = imageTag[1];
      }
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new TaskDefinition();
      out.containers = await Promise.all(td.containerDefinitions.map(async (tdc: any) => {
        const container = await ctx.orm.findOne(Container, {
          where: {
            name: tdc.name,
          },
        });
        if (!container) return AwsEcsModule.utils.containerMapper(tdc, ctx);
        return container;
      }));
      out.cpuMemory = `${+td.cpu / 1024}vCPU-${+td.memory / 1024}GB` as CpuMemCombination;
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
      })) ?? [];
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      out.taskRoleArn = td.taskRoleArn;
      return out;
    },
    serviceMapper: async (s: any, ctx: Context) => {
      const out = new Service();
      out.arn = s.serviceArn;
      out.cluster = s.clusterArn && ctx.memo?.db?.Cluster?.[s.clusterArn] ? ctx.memo?.db?.Cluster?.[s.clusterArn] : await AwsEcsModule.mappers.cluster.db.read(ctx, s.clusterArn);
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
          slb2.targetGroup = ctx.memo?.db?.AwsTargetGroup?.[slb.targetGroupArn] ?? await AwsElbModule.mappers.targetGroup.db.read(ctx, slb.targetGroupArn);
        }
        return slb2;
      }) ?? []);
      out.name = s.serviceName;
      if (s.networkConfiguration?.awsvpcConfiguration) {
        const networkConf = s.networkConfiguration.awsvpcConfiguration;
        const awsVpcConf = new AwsVpcConf();
        awsVpcConf.assignPublicIp = networkConf.assignPublicIp;
        awsVpcConf.securityGroups = await Promise.all(networkConf.securityGroups?.map(async (sg: string) =>
          ctx.memo?.db?.AwsSecurityGroup?.sg ?? await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg)) ?? []);
        awsVpcConf.subnets = await Promise.all(networkConf.subnets?.map(async (s: string) =>
          ctx.memo?.db?.AwsSubnets?.s ?? await AwsAccount.mappers.subnet.db.read(ctx, s)) ?? []);
        out.network = awsVpcConf;
      }
      out.schedulingStrategy = s.schedulingStrategy as SchedulingStrategy;
      out.status = s.status;
      if (s.taskDefinition) {
        out.task = ctx.memo?.db?.TaskDefinition?.[s.taskDefinition] ?? await AwsEcsModule.mappers.taskDefinition.db.read(ctx, s.taskDefinition);
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
          await Promise.all(es.map(e => client.deleteCluster(e.clusterName)));
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
          await Promise.all(es.map(async (entity: TaskDefinition) => {
            if (entity.containers) {
              await ctx.orm.save(Container, entity.containers);
            }
          }));
          await ctx.orm.save(TaskDefinition, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['reqCompatibilities', 'containers', 'containers.portMappings', 'containers.environment', 'containers.repository'];
          const opts = id ? {
            where: {
              name: Array.isArray(id) ? In(id) : id,
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
            return await Promise.all(result.taskDefinitions.map(async (td: any) => AwsEcsModule.utils.taskDefinitionMapper(td, ctx)));
          }
        },
        update: async (_td: TaskDefinition | TaskDefinition[], _ctx: Context) => { throw new Error('Cannot update task definitions. Create a new revision'); },
        delete: async (td: TaskDefinition | TaskDefinition[], ctx: Context) => {
          // TODO: once service implemented, do not delete task if it is being used by a service
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(td) ? td : [td];
          await Promise.all(es.map(e => client.deleteTaskDefinition(e.taskDefinitionArn!)));
        },
      }),
    }),
    service: new Mapper<Service>({
      entity: Service,
      entityId: (e: Service) => e?.arn ?? '',
      equals: (_a: Service, _b: Service) => true,  // TODO: Fill in when updates supported
      source: 'db',
      db: new Crud({
        create: async (e: Service | Service[], ctx: Context) => {
          // TODO
          // const es = Array.isArray(e) ? e : [e];
          // // Deduplicate Compatibility ahead of time, preserving an ID if it exists
          // const compatibilities: { [key: string]: Compatibility, } = {};
          // es.forEach((entity: Service) => {
          //   if (entity.reqCompatibilities) {
          //     entity.reqCompatibilities.forEach(rc => {
          //       const name: any = rc.name;
          //       compatibilities[name] = compatibilities[name] ?? rc;
          //       if (rc.id) compatibilities[name].id = rc.id;
          //       rc = compatibilities[name];
          //     })
          //   }
          // });
          // await ctx.orm.save(Compatibility, Object.values(compatibilities));
          // await Promise.all(es.map(async (entity: Service) => {
          //   if (entity.containers) {
          //     await ctx.orm.save(Container, entity.containers);
          //   }
          // }));
          // await ctx.orm.save(Service, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['cluster', 'task', 'network', 'loadBalancers'];
          const opts = id ? {
            where: {
              arn: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(Service, opts) : await ctx.orm.findOne(Service, opts);
        },
        update: async (e: Service | Service[], ctx: Context) => {
          // TODO
          // const es = Array.isArray(e) ? e : [e];
          // // Deduplicate Compatibility ahead of time, preserving an ID if it exists
          // const compatibilities: { [key: string]: Compatibility, } = {};
          // es.forEach((entity: Service) => {
          //   if (entity.reqCompatibilities) {
          //     entity.reqCompatibilities.forEach(rc => {
          //       const name: any = rc.name;
          //       compatibilities[name] = compatibilities[name] ?? rc;
          //       if (rc.id) compatibilities[name].id = rc.id;
          //       rc = compatibilities[name];
          //     })
          //   }
          // });
          // await ctx.orm.save(Compatibility, Object.values(compatibilities));
          // es.map(async (entity: Service) => {
          //   if (entity.containers) {
          //     await ctx.orm.save(Container, entity.containers);
          //   }
          // });
          // await ctx.orm.save(Service, es);
        },
        delete: async (c: Service | Service[], ctx: Context) => {
          // TODO
          // await ctx.orm.remove(Service, c);
        },
      }),
      cloud: new Crud({
        create: async (td: Service | Service[], ctx: Context) => {
          // TODO
          // const client = await ctx.getAwsClient() as AWS;
          // const es = Array.isArray(td) ? td : [td];
          // const out = await Promise.all(es.map(async (e) => {
          //   const input: any = {
          //     family: e.family,
          //     containerDefinitions: e.containers.map(c => {
          //       const container: any = { ...c };
          //       container.image = `${c.repository ? c.repository.repositoryUri : c.dockerImage}:${c.tag}`;
          //       return container;
          //     }),
          //     requiresCompatibilities: e.reqCompatibilities?.map(c => c.name!) ?? [],
          //     networkMode: e.networkMode,
          //     taskRoleArn: e.taskRoleArn,
          //     executionRoleArn: e.executionRoleArn,
          //   };
          //   if (e.cpuMemory) {
          //     const [cpuStr, memoryStr] = e.cpuMemory.split('-');
          //     const cpu = cpuStr.split('vCPU')[0];
          //     input.cpu = `${+cpu * 1024}`;
          //     const memory = memoryStr.split('GB')[0];
          //     input.memory = `${+memory * 1024}`;
          //   }

          //   const result = await client.createTaskDefinition(input);
          //   // TODO: Handle if it fails (somehow)
          //   if (!result?.hasOwnProperty('taskDefinitionArn')) { // Failure
          //     throw new Error('what should we do here?');
          //   }
          //   // Re-get the inserted record to get all of the relevant records we care about
          //   const newObject = await client.getTaskDefinition(result.taskDefinitionArn ?? '');
          //   // We map this into the same kind of entity as `obj`
          //   const newEntity = await AwsEcsModule.utils.taskDefinitionMapper(newObject, ctx);
          //   // We attach the original object's ID to this new one, indicating the exact record it is
          //   // replacing in the database.
          //   newEntity.id = e.id;
          //   // Save the record back into the database to get the new fields updated
          //   await AwsEcsModule.mappers.taskDefinition.db.update(newEntity, ctx);
          //   return newEntity;
          // }));
          // // Make sure the dimensionality of the returned data matches the input
          // if (Array.isArray(td)) {
          //   return out;
          // } else {
          //   return out[0];
          // }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          // TODO
          // const client = await ctx.getAwsClient() as AWS;
          // if (ids) {
          //   if (Array.isArray(ids)) {
          //     return await Promise.all(ids.map(async (id) => {
          //       return await AwsEcsModule.utils.taskDefinitionMapper(
          //         await client.getTaskDefinition(id), ctx
          //       );
          //     }));
          //   } else {
          //     return await AwsEcsModule.utils.taskDefinitionMapper(
          //       await client.getTaskDefinition(ids), ctx
          //     );
          //   }
          // } else {
          //   const result = await client.getTaskDefinitions();
          //   return await Promise.all(result.taskDefinitions.map(async (td: any) => AwsEcsModule.utils.taskDefinitionMapper(td, ctx)));
          // }
        },
        update: async (_td: Service | Service[], _ctx: Context) => { throw new Error('TBD'); },
        delete: async (td: Service | Service[], ctx: Context) => {
          // TODO
          // // TODO: once service implemented, do not delete task if it is being used by a service
          // const client = await ctx.getAwsClient() as AWS;
          // const es = Array.isArray(td) ? td : [td];
          // await Promise.all(es.map(e => client.deleteTaskDefinition(e.taskDefinitionArn!)));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEcs1637669736785.prototype.up,
    preremove: awsEcs1637669736785.prototype.down,
  },
});
