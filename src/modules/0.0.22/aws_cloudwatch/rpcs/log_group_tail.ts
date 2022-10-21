import { CloudWatchLogs, FilteredLogEvent } from '@aws-sdk/client-cloudwatch-logs';

import { AwsCloudwatchModule } from '..';
import { AWS, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class LogGroupTailRpc extends RpcBase {
  module: AwsCloudwatchModule;
  outputTable = {
    event_id: 'varchar',
    log_stream_name: 'varchar',
    event_timestamp: 'timestamp with time zone',
    message: 'varchar',
  } as const;

  filterLogEvents = crudBuilderFormat<CloudWatchLogs, 'filterLogEvents', FilteredLogEvent[]>(
    'filterLogEvents',
    logGroupName => ({ logGroupName, limit: 1000 }), // Opinionated limit. We can start and see if it is enough, cannot imagine some reading more than a thousand db records of logs
    res => res?.events ?? [],
  );

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    logGroupName: string,
    region?: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // we need to have bucket name as first element of params
    if (!logGroupName) {
      throw new Error('Invalid log group name');
    }
    const clientRegion = region ?? (await ctx.getDefaultRegion());
    const client = (await ctx.getAwsClient(clientRegion)) as AWS;
    const logEvents = await this.filterLogEvents(client.cwClient, logGroupName);
    return logEvents.map(le => ({
      event_id: le.eventId,
      log_stream_name: le.logStreamName,
      event_timestamp: le.timestamp ? new Date(le.timestamp) : le.timestamp,
      message: le.message,
    }));
  };

  constructor(module: AwsCloudwatchModule) {
    super();
    this.module = module;
    super.init();
  }
}
