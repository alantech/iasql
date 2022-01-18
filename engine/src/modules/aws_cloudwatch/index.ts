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
      equals: (a: LogGroup, b: LogGroup) => Object.is(a.logGroupName, b.logGroupName)
        && Object.is(a.logGroupArn, b.logGroupArn)
        && Object.is(a.creationTime, b.creationTime),
      source: 'db',
      db: new Crud({
        create: (e: LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(LogGroup, ids ? {
          where: {
            logGroupName: In(ids),
          },
        } : undefined),
        update: (e: LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        delete: (e: LogGroup[], ctx: Context) => ctx.orm.remove(LogGroup, e),
      }),
      cloud: new Crud({
        create: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(lg.map(async (e) => {
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
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          ids = Array.isArray(ids) ? ids : []
          const logGroups = (await Promise.all(ids.map(id => client.getLogGroups(id)))).flat();
          return await Promise.all(
            logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg, ctx))
          );
        },
        update: async (lg: LogGroup[], ctx: Context) => {
          return await Promise.all(lg.map(async (e) => {
            try {
              return await AwsCloudwatchModule.mappers.logGroup.cloud.create(e, ctx);
            } catch (_) {
              e.logGroupName = Date.now().toString();
              return await AwsCloudwatchModule.mappers.logGroup.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(lg.map((e) => client.deleteLogGroup(e.logGroupName)));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsCloudwatch1638980988627.prototype.up,
    preremove: awsCloudwatch1638980988627.prototype.down,
  },
});
