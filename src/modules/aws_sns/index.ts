import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { TopicMapper } from './mappers';

export class AwsSnsModule extends ModuleBase {
  /** @internal */
  topic: TopicMapper;
  invokeSns: AwsSdkInvoker;

  constructor() {
    super();
    this.topic = new TopicMapper(this);
    this.invokeSns = new AwsSdkInvoker('snsClient', this);
    super.init();
  }
}

export const awsSnsModule = new AwsSnsModule();
