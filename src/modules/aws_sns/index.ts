import { ModuleBase } from '../interfaces';
import { TopicMapper, SubscriptionMapper } from './mappers';
import { ConfirmSubscriptionRpc } from './rpcs';

export class AwsSnsModule extends ModuleBase {
  /** @internal */
  topic: TopicMapper;
  subscription: SubscriptionMapper;
  confirmSubscription: ConfirmSubscriptionRpc;

  constructor() {
    super();
    this.topic = new TopicMapper(this);
    this.subscription = new SubscriptionMapper(this);
    this.confirmSubscription = new ConfirmSubscriptionRpc(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-sns-integration.ts#AwsSNS Integration Testing#Manage SNS
 * ```
 */
export const awsSnsModule = new AwsSnsModule();
