import { ModuleBase } from '../interfaces';
import { ListenerMapper } from './mappers/listener';
import { LoadBalancerMapper } from './mappers/load_balancer';
import { TargetGroupMapper } from './mappers/target_group';

export class AwsElbModule extends ModuleBase {
  /** @internal */
  listener: ListenerMapper;

  /** @internal */
  loadBalancer: LoadBalancerMapper;

  /** @internal */
  targetGroup: TargetGroupMapper;

  constructor() {
    super();
    this.listener = new ListenerMapper(this);
    this.loadBalancer = new LoadBalancerMapper(this);
    this.targetGroup = new TargetGroupMapper(this);
    super.init();
  }
}

export const awsElbModule = new AwsElbModule();
