import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { LogGroupMapper } from './mappers';
import { MetricAlarmMapper } from './mappers/metric_alarm';
import { LogGroupTailRpc } from './rpcs';

export class AwsCloudwatchModule extends ModuleBase {
  /** @internal */
  logGroup: LogGroupMapper;
  logGroupTail: LogGroupTailRpc;
  metricAlarm: MetricAlarmMapper;
  invokeCloudwatchLogs: AwsSdkInvoker;
  invokeCloudwatch: AwsSdkInvoker;

  constructor() {
    super();
    this.logGroup = new LogGroupMapper(this);
    this.logGroupTail = new LogGroupTailRpc(this);
    this.metricAlarm = new MetricAlarmMapper(this);
    this.invokeCloudwatchLogs = new AwsSdkInvoker('cwClient', this);
    this.invokeCloudwatch = new AwsSdkInvoker('cloudwatchClient', this);
    super.init();
  }
}

export const awsCloudwatchModule = new AwsCloudwatchModule();
