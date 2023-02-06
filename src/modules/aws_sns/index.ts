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

/**
 * ```testdoc
 * modules/aws-sns-integration.ts#AwsSNS Integration Testing#Code examples
 * ```
 */
export const awsSnsModule = new AwsSnsModule();
