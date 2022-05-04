import { AWS, } from '../../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import { LogGroup } from './entity'
import * as metadata from './module.json'

export const AwsCloudwatchModule: Module = new Module({
  ...metadata,
  utils: {
    logGroupMapper: (lg: any) => {
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
      equals: (a: LogGroup, b: LogGroup) => Object.is(a.logGroupName, b.logGroupName)
        && Object.is(a.logGroupArn, b.logGroupArn)
        && Object.is(a.creationTime?.getTime(), b.creationTime?.getTime()),
      source: 'db',
      cloud: new Crud({
        create: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = []
          for (const e of lg) {
            await client.createLogGroup(e.logGroupName);
            // Re-get the inserted record to get all of the relevant records we care about
            const logGroups = await client.getLogGroups(e.logGroupName);
            const newObject = logGroups.find(l => l.logGroupName === e.logGroupName);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsCloudwatchModule.utils.logGroupMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsCloudwatchModule.mappers.logGroup.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
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
          return logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg));
        },
        updateOrReplace: () => 'update',
        update: async (es: LogGroup[], ctx: Context) => {
          // Right now we can only modify AWS-generated fields in the database.
          // This implies that on `update`s we only have to restore the values for those records.
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.LogGroup?.[e.logGroupName ?? ''];
            await AwsCloudwatchModule.mappers.logGroup.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
          return out;
        },
        delete: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of lg) {
            await client.deleteLogGroup(e.logGroupName);
          }
        },
      }),
    }),
  },
}, __dirname);
