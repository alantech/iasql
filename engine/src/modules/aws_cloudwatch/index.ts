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
        create: (e: LogGroup | LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        read: (ctx: Context, id?: string | string[] | undefined) => ctx.orm.find(LogGroup, id ? {
          where: {
            logGroupName: Array.isArray(id) ? In(id) : id,
          },
        } : undefined),
        update: (e: LogGroup | LogGroup[], ctx: Context) => ctx.orm.save(LogGroup, e),
        delete: (e: LogGroup | LogGroup[], ctx: Context) => ctx.orm.remove(LogGroup, e),
      }),
      cloud: new Crud({
        create: async (lg: LogGroup | LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lg) ? lg : [lg];
          return await Promise.all(es.map(async (e) => {
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
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          ids = Array.isArray(ids) ?
            ids :
            ids === undefined ?
              [] :
              [ids];
          const logGroups = (await Promise.all(ids.map(id => client.getLogGroups(id)))).flat();
          return await Promise.all(
            logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg, ctx))
          );
        },
        update: async (_lg: LogGroup | LogGroup[], _ctx: Context) => { /** TODO */ },
        delete: async (lg: LogGroup | LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(lg) ? lg : [lg];
          await Promise.all(es.map((e) => client.deleteLogGroup(e.logGroupName)));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsCloudwatch1638980988627.prototype.up,
    preremove: awsCloudwatch1638980988627.prototype.down,
  },
});
