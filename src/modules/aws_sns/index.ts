import { ModuleBase } from '../interfaces';
import { TopicMapper, SubscriptionMapper } from './mappers';

export class AwsSnsModule extends ModuleBase {
  /** @internal */
  topic: TopicMapper;
  subscription: SubscriptionMapper;

  constructor() {
    super();
    this.topic = new TopicMapper(this);
    this.subscription = new SubscriptionMapper(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-sns-integration.ts#AwsSNS Integration Testing#Manage SNS
 * ```
 */
export const awsSnsModule = new AwsSnsModule();
