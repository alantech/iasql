import { ModuleBase } from '../../interfaces';
import { CodedeployApplicationMapper } from './mappers';

export class AwsCodedeployModule extends ModuleBase {
  application: CodedeployApplicationMapper;

  constructor() {
    super();
    this.application = new CodedeployApplicationMapper(this);
    super.init();
  }
}
export const awsCodedeployModule = new AwsCodedeployModule();
