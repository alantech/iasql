import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { LogGroup } from './entity'
import { awsCloudwatch1638980988627 } from './migration/1638980988627-aws_cloudwatch'

export const AwsCloudwatchModule: Module = new Module({
  name: 'aws_cloudwatch',
  dependencies: ['aws_account'],
  provides: {
    entities: allEntities,
    tables: ['log_group',],
    functions: ['create_cloudwatch_log_group',],
  },
  utils: {
    logGroupMapper: (lg: any, _ctx: Context) => {
      const out = new LogGroup();
      if (!lg?.logGroupName) throw new Error('No log group name defined');
      out.logGroupName = lg.logGroupName;
      out.logGroupArn = lg.arn;
      out.creationTime = lg.creationTime ? new Date(lg.creationTime) : lg.creationTime;
      return out;
    },
  },
  mappers: {
    logGroup: new Mapper<LogGroup>({
      entity: LogGroup,
      entityId: (e: LogGroup) => e?.logGroupName,
      entityPrint: (e: LogGroup) => ({
        id: e?.id?.toString() ?? '',
        logGroupName: e?.logGroupName ?? '',
        logGroupArn: e?.logGroupArn ?? '',
        creationTime: e?.creationTime?.toISOString() ?? '',
      }),
      equals: (_a: LogGroup, _b: LogGroup) => true, // TODO: Fix this
      source: 'db',
      db: new Crud({
        create: async (e: LogGroup | LogGroup[], ctx: Context) => { await ctx.orm.save(LogGroup, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const opts = id ? {
            where: {
              logGroupName: Array.isArray(id) ? In(id) : id,
            },
          } : undefined;
          return (!id || Array.isArray(id)) ? await ctx.orm.find(LogGroup, opts) : await ctx.orm.findOne(LogGroup, opts);
        },
        update: async (e: LogGroup | LogGroup[], ctx: Context) => { await ctx.orm.save(LogGroup, e); },
        delete: async (e: LogGroup | LogGroup[], ctx: Context) => { await ctx.orm.remove(LogGroup, e); },
      }),
      cloud: new Crud({
        create: async (lg: LogGroup | LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lg) ? lg : [lg];
          const out = await Promise.all(es.map(async (e) => {
            await client.createLogGroup(e.logGroupName);
            // Re-get the inserted record to get all of the relevant records we care about
            const logGroups = await client.getLogGroups(e.logGroupName);
            const newObject = logGroups.find(l => l.logGroupName === e.logGroupName);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsCloudwatchModule.utils.logGroupMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsCloudwatchModule.mappers.logGroup.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(lg)) {
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
                const logGroups = await client.getLogGroups(id);
                const logGroup = logGroups.find(lg => lg.logGroupName === id);
                return await AwsCloudwatchModule.utils.logGroupMapper(logGroup, ctx);
              }));
            } else {
              const logGroups = await client.getLogGroups(ids);
              const logGroup = logGroups.find(lg => lg.logGroupName === ids);
              return await AwsCloudwatchModule.utils.logGroupMapper(logGroup, ctx);
            }
          } else {
            const logGroups = (await client.getLogGroups()) ?? [];
            return await Promise.all(
              logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg, ctx))
            );
          }
        },
        update: async (_lg: LogGroup | LogGroup[], _ctx: Context) => { /** TODO */ },
        delete: async (lg: LogGroup | LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lg) ? lg : [lg];
          await Promise.all(es.map(async (e) => {
            await client.deleteLogGroup(e.logGroupName);
          }));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsCloudwatch1638980988627.prototype.up,
    preremove: awsCloudwatch1638980988627.prototype.down,
  },
});
