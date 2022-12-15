import { ModuleBase } from '../interfaces';
import { LogGroupMapper } from './mappers';
import { LogGroupTailRpc } from './rpcs';

export class AwsCloudwatchModule extends ModuleBase {
  /** @internal */
  logGroup: LogGroupMapper;
  logGroupTail: LogGroupTailRpc;

  constructor() {
    super();
    this.logGroup = new LogGroupMapper(this);
    this.logGroupTail = new LogGroupTailRpc(this);
    super.init();
  }
}

export const awsCloudwatchModule = new AwsCloudwatchModule();
