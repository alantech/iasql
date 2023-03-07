import {
  CloudWatchLogs,
  DescribeLogGroupsCommandInput,
  paginateDescribeLogGroups,
} from '@aws-sdk/client-cloudwatch-logs';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsCloudwatchModule } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { LogGroup } from '../entity';

export class LogGroupMapper extends MapperBase<LogGroup> {
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

  async waitForLogGroup(client: CloudWatchLogs, logGroupNamePrefix: string) {
    return createWaiter<CloudWatchLogs, DescribeLogGroupsCommandInput>(
      {
        client,
        // 10 min waiter
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        logGroupNamePrefix,
      },
      async (cl, input) => {
        try {
          const data = await cl.describeLogGroups(input);
          if (!data.logGroups?.length) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  logGroupMapper(lg: any, region: string) {
    const out = new LogGroup();
    if (!lg?.logGroupName) return undefined;
    out.logGroupName = lg.logGroupName;
    out.logGroupArn = lg.arn;
    out.creationTime = lg.creationTime ? new Date(lg.creationTime) : lg.creationTime;
    out.region = region;
    return out;
  }

  cloud = new Crud<LogGroup>({
    create: async (lg: LogGroup[], ctx: Context) => {
      const out = [];
      for (const e of lg) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.createLogGroup(client.cwClient, e.logGroupName);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getLogGroup(client.cwClient, e.logGroupName);
        // We map this into the same kind of entity as `obj`
        const newEntity = this.logGroupMapper(newObject, e.region);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        if (e.id) {
          newEntity.id = e.id;
          await this.module.logGroup.db.update(newEntity, ctx);
        }
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { logGroupName, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawLogGroup = await this.getLogGroup(client.cwClient, logGroupName);
          if (rawLogGroup) return this.logGroupMapper(rawLogGroup, region);
        }
      } else {
        const out: LogGroup[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const logGroups = (await this.getLogGroups(client.cwClient)) ?? [];
            for (const i of logGroups) {
              const lg = this.logGroupMapper(i, region);
              if (lg) out.push(lg);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: LogGroup[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      // If the region is changed, it won't be an update since the entityId is changed
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.LogGroup?.[this.entityId(e)];
        cloudRecord.id = e.id;
        await this.module.logGroup.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (lg: LogGroup[], ctx: Context) => {
      for (const e of lg) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
