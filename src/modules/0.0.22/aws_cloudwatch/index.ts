import { ModuleBase } from '../../interfaces';
import { LogGroupMapper } from './mappers';

export class AwsCloudwatchModule extends ModuleBase {
  logGroup: LogGroupMapper;

  constructor() {
    super();
    this.logGroup = new LogGroupMapper(this);
    super.init();
  }
}

export const awsCloudwatchModule = new AwsCloudwatchModule();
