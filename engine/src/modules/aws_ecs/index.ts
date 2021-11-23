import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import {
  Cluster,
  Compatibility,
  Container,
  CpuMemCombination,
  EnvVariable,
  PortMapping,
  TaskDefinition,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcs1637669736785, } from './migration/1637669736785-aws_ecs'
import { AwsEcrModule } from '..'

export const AwsEcsModule: Module = new Module({
  name: 'aws_ecs',
  dependencies: ['aws_account', 'aws_ecr',],
  provides: {
    entities: allEntities,
    tables: ['cluster',],
    functions: ['create_ecs_cluster',],
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
        // out.repository = null;
        out.tag = imageTag[1];
      } else {
        const repositories = ctx.memo?.cloud?.AwsRepository ?? await AwsEcrModule.mappers.repository.cloud.read(ctx);
        out.repository = repositories.find((r: any) => r.repositoryUri === imageTag[0]);
        // out.dockerImage = null;
        out.tag = imageTag[1];
      }
      return out;
    },
    taskDefinitionMapper: async (td: any, ctx: Context) => {
      const out = new TaskDefinition();
      out.containers = await Promise.all(td.containerDefinitions.map((tdc: any) => AwsEcsModule.utils.containerMapper(tdc, ctx)));
      out.cpuMemory = `${+td.cpu / 1024}vCPU-${+td.memory / 1024}GB` as CpuMemCombination;
      out.executionRoleArn = td.executionRoleArn;
      out.family = td.family;
      out.networkMode = td.networkMode;
      out.reqCompatibilities = td.requiresCompatibilities?.map((rc: any) => {
        const rc2 = new Compatibility();
        rc2.name = rc.name;
        return rc2;
      }) ?? [];
      out.revision = td.revision;
      out.status = td.status;
      out.taskDefinitionArn = td.taskDefinitionArn;
      out.taskRoleArn = td.taskRoleArn;
      return out;
    },
  },
  mappers: {
    cluster: new Mapper<Cluster>({
      entity: Cluster,
      entityId: (e: Cluster) => e?.clusterName ?? 'default',
      equals: (_a: Cluster, _b: Cluster) => true,  // TODO: Fill in when updates supported
      source: 'db',
      db: new Crud({
        create: async (c: Cluster | Cluster[], ctx: Context) => { await ctx.orm.save(Cluster, c);},
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const opts = id ? {
            where: {
              clusterName: Array.isArray(id) ? In(id) : id,
            },
          } : undefined;
          return (!id || Array.isArray(id)) ? await ctx.orm.find(Cluster, opts) : await ctx.orm.findOne(Cluster, opts);
        },
        update: async (c: Cluster | Cluster[], ctx: Context) => { await ctx.orm.save(Cluster, c);},
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
            if (!result?.hasOwnProperty('clusterName')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getCluster(result.clusterName ?? 'default');
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
          es.map(async (entity: TaskDefinition) => {
            if (entity.containers) {
              await ctx.orm.save(Container, entity.containers);
            }
          });
          await ctx.orm.save(TaskDefinition, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['containers', 'containers.portMappings', 'containers.environment'];
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
                const container: any = {...c};
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
  },
  migrations: {
    postinstall: awsEcs1637669736785.prototype.up,
    preremove: awsEcs1637669736785.prototype.down,
  },
});
