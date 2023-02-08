import { CloudWatchLogs, FilteredLogEvent } from '@aws-sdk/client-cloudwatch-logs';

import { AwsCloudwatchModule } from '..';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method for tailing logs for an specific CloudWatch log group.
 *
 * Returns a set of SQL records with the following format:
 *
 * - event_id: The ID of the event for the produced log
 * - log_stream_name: Name of the log stream that is visualized
 * - event_timestamp: The timestamp for the log entry
 * - message: The content of the log entry
 *
 * @see https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/tail.html
 *
 */
export class LogGroupTailRpc extends RpcBase {
  /** @internal */
  module: AwsCloudwatchModule;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  outputTable = {
    event_id: 'varchar',
    log_stream_name: 'varchar',
    event_timestamp: 'timestamp with time zone',
    message: 'varchar',
  } as const;

  /** @internal */
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
