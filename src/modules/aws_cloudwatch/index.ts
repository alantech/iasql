import { ModuleBase } from '../interfaces';
import { LogGroupMapper } from './mappers';
import { MetricAlarmMapper } from './mappers/metric_alarm';
import { LogGroupTailRpc } from './rpcs';

export class AwsCloudwatchModule extends ModuleBase {
  /** @internal */
  logGroup: LogGroupMapper;
  logGroupTail: LogGroupTailRpc;
  metricAlarm: MetricAlarmMapper;

  constructor() {
    super();
    this.logGroup = new LogGroupMapper(this);
    this.logGroupTail = new LogGroupTailRpc(this);
    this.metricAlarm = new MetricAlarmMapper(this);
    super.init();
  }
}

/**
 * ### Code examples
 *
 * ```testdoc
 * modules/aws-cloudwatch-integration.ts#AwsCloudwatch Integration Testing#Manage cloudwatch
 * modules/aws-tail-log-group.ts#AwsCloudwatch and AwsLambda Integration Testing#Tail logs
 * ```
 */
export const awsCloudwatchModule = new AwsCloudwatchModule();
