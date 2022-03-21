import { AWS, } from '../../services/gateways/aws'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { LogGroup } from './entity'
import * as metadata from './module.json'

export const AwsCloudwatchModule: Module = new Module({
  ...metadata,
  provides: {
    entities: allEntities,
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
      entityPrint: (e: LogGroup) => ({
        id: e?.id?.toString() ?? '',
        logGroupName: e?.logGroupName ?? '',
        logGroupArn: e?.logGroupArn ?? '',
        creationTime: e?.creationTime?.toISOString() ?? '',
      }),
      equals: (a: LogGroup, b: LogGroup) => Object.is(a.logGroupName, b.logGroupName)
        && Object.is(a.logGroupArn, b.logGroupArn)
        && Object.is(a.creationTime?.getTime(), b.creationTime?.getTime()),
      source: 'db',
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
          let logGroups = [];
          if (Array.isArray(ids)) {
            for (const id of ids) {
              logGroups.push(...(await client.getLogGroups(id)));
            }
          } else {
            logGroups = (await client.getLogGroups()) ?? [];
          }
          return await Promise.all(logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg, ctx)));
        },
        updateOrReplace: () => 'update',
        update: async (es: LogGroup[], ctx: Context) => {
          // Right now we can only modify AWS-generated fields in the database.
          // This implies that on `update`s we only have to restore the values for those records.
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.LogGroup?.[e.logGroupName ?? ''];
            cloudRecord.id = e.id;
            await AwsCloudwatchModule.mappers.logGroup.db.update(cloudRecord, ctx);
            return cloudRecord;
          }));
        },
        delete: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(lg.map((e) => client.deleteLogGroup(e.logGroupName)));
        },
      }),
    }),
  },
}, __dirname);
