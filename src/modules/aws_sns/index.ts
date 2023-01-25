import { ModuleBase } from '../interfaces';
import { TopicMapper } from './mappers';

export class AwsSnsModule extends ModuleBase {
  /** @internal */
  topic: TopicMapper;

  constructor() {
    super();
    this.topic = new TopicMapper(this);
    super.init();
  }
}

export const awsSnsModule = new AwsSnsModule();
