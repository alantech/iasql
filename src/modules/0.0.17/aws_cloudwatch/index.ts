import { CloudWatchLogs, paginateDescribeLogGroups } from '@aws-sdk/client-cloudwatch-logs';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { LogGroup } from './entity';

class LogGroupMapper extends MapperBase<LogGroup> {
  module: AwsCloudwatchModule;
  entity = LogGroup;
  equals = (a: LogGroup, b: LogGroup) =>
    Object.is(a.logGroupName, b.logGroupName) &&
    Object.is(a.logGroupArn, b.logGroupArn) &&
    Object.is(a.creationTime?.getTime(), b.creationTime?.getTime());

  createLogGroup = crudBuilderFormat<CloudWatchLogs, 'createLogGroup', undefined>(
    'createLogGroup',
    logGroupName => ({ logGroupName }),
    _lg => undefined,
  );
  getLogGroups = paginateBuilder<CloudWatchLogs>(paginateDescribeLogGroups, 'logGroups');
  async getLogGroup(client: CloudWatchLogs, groupName: string) {
    return (await this.getLogGroups(client)).find(lg => lg.logGroupName === groupName);
  }
  deleteLogGroup = crudBuilderFormat<CloudWatchLogs, 'deleteLogGroup', undefined>(
    'deleteLogGroup',
    logGroupName => ({ logGroupName }),
    _lg => undefined,
  );
  logGroupMapper(lg: any) {
    const out = new LogGroup();
    if (!lg?.logGroupName) return undefined;
    out.logGroupName = lg.logGroupName;
    out.logGroupArn = lg.arn;
    out.creationTime = lg.creationTime ? new Date(lg.creationTime) : lg.creationTime;
    return out;
  }

  cloud = new Crud2<LogGroup>({
    create: async (lg: LogGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of lg) {
        await this.createLogGroup(client.cwClient, e.logGroupName);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getLogGroup(client.cwClient, e.logGroupName);
        // We map this into the same kind of entity as `obj`
        const newEntity = this.logGroupMapper(newObject);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.logGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawLogGroup = await this.getLogGroup(client.cwClient, id);
        if (!rawLogGroup) return;
        return this.logGroupMapper(rawLogGroup);
      } else {
        const logGroups = (await this.getLogGroups(client.cwClient)) ?? [];
        const out = [];
        for (const logGroup of logGroups) {
          const outLog = this.logGroupMapper(logGroup);
          if (outLog) out.push(outLog);
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: LogGroup[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.LogGroup?.[e.logGroupName ?? ''];
        await this.module.logGroup.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (lg: LogGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of lg) {
        await this.deleteLogGroup(client.cwClient, e.logGroupName);
      }
    },
  });

  constructor(module: AwsCloudwatchModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsCloudwatchModule extends ModuleBase {
  logGroup: LogGroupMapper;

  constructor() {
    super();
    this.logGroup = new LogGroupMapper(this);
    super.init();
  }
}
export const awsCloudwatchModule = new AwsCloudwatchModule();
