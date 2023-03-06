import { ModuleBase } from '../interfaces';
import { TopicMapper, SubscriptionMapper } from './mappers';
import { ConfirmSubscriptionRpc, SubscribeRpc } from './rpcs';
import { UnsubscribeRpc } from './rpcs/unsubscribe';

export class AwsSnsModule extends ModuleBase {
  /** @internal */
  topic: TopicMapper;
  subscription: SubscriptionMapper;
  subscribe: SubscribeRpc;
  unsubscribe: UnsubscribeRpc;
  confirmSubscription: ConfirmSubscriptionRpc;

  constructor() {
    super();
    this.topic = new TopicMapper(this);
    this.subscription = new SubscriptionMapper(this);
    this.confirmSubscription = new ConfirmSubscriptionRpc(this);
    this.subscribe = new SubscribeRpc(this);
    this.unsubscribe = new UnsubscribeRpc(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-sns-integration.ts#AwsSNS Integration Testing#Manage SNS
 * ```
 */
export const awsSnsModule = new AwsSnsModule();
