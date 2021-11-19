import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import {
  Cluster
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcs1637344460351, } from './migration/1637344460351-aws_ecs'

export const AwsEcsModule: Module = new Module({
  name: 'aws_ecs',
  dependencies: ['aws_account',],
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
  },
  migrations: {
    postinstall: awsEcs1637344460351.prototype.up,
    preremove: awsEcs1637344460351.prototype.down,
  },
});
