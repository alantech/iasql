import { CloudWatchLogs, paginateDescribeLogGroups, } from '@aws-sdk/client-cloudwatch-logs'
import { AWS, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { LogGroup } from './entity'
import * as metadata from './module.json'

const createLogGroup = crudBuilderFormat<CloudWatchLogs, 'createLogGroup', undefined>(
  'createLogGroup',
  (logGroupName) => ({ logGroupName, }),
  (_lg) => undefined,
);
const getLogGroups = paginateBuilder<CloudWatchLogs>(
  paginateDescribeLogGroups,
  'logGroups',
);
const getLogGroup = async (client: CloudWatchLogs, groupName: string) => (
  await getLogGroups(client)
).find(lg => lg.logGroupName === groupName);
const deleteLogGroup = crudBuilderFormat<CloudWatchLogs, 'deleteLogGroup', undefined>(
  'deleteLogGroup',
  (logGroupName) => ({ logGroupName, }),
  (_lg) => undefined,
);

export const AwsCloudwatchModule: Module2 = new Module2({
  ...metadata,
  utils: {
    logGroupMapper: (lg: any) => {
      const out = new LogGroup();
      if (!lg?.logGroupName) return undefined;
      out.logGroupName = lg.logGroupName;
      out.logGroupArn = lg.arn;
      out.creationTime = lg.creationTime ? new Date(lg.creationTime) : lg.creationTime;
      return out;
    },
  },
  mappers: {
    logGroup: new Mapper2<LogGroup>({
      entity: LogGroup,
      equals: (a: LogGroup, b: LogGroup) => Object.is(a.logGroupName, b.logGroupName)
        && Object.is(a.logGroupArn, b.logGroupArn)
        && Object.is(a.creationTime?.getTime(), b.creationTime?.getTime()),
      source: 'db',
      cloud: new Crud2({
        create: async (lg: LogGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = []
          for (const e of lg) {
            await createLogGroup(client.cwClient, e.logGroupName);
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await getLogGroup(client.cwClient, e.logGroupName);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsCloudwatchModule.utils.logGroupMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsCloudwatchModule.mappers.logGroup.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawLogGroup = await getLogGroup(client.cwClient, id);
            if (!rawLogGroup) return;
            return AwsCloudwatchModule.utils.logGroupMapper(rawLogGroup);
          } else {
            const logGroups = (await getLogGroups(client.cwClient)) ?? [];
            return logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg));
          }
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
            await deleteLogGroup(client.cwClient, e.logGroupName);
          }
        },
      }),
    }),
  },
}, __dirname);
