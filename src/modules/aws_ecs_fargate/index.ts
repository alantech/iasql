import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { ClusterMapper, ServiceMapper, TaskDefinitionMapper } from './mappers';
import { DeployServiceRPC } from './rpcs';

export class AwsEcsFargateModule extends ModuleBase {
  /** @internal */
  cluster: ClusterMapper;

  /** @internal */
  taskDefinition: TaskDefinitionMapper;

  /** @internal */
  service: ServiceMapper;

  deployService: DeployServiceRPC;

  invokeEcs: AwsSdkInvoker;

  constructor() {
    super();
    this.cluster = new ClusterMapper(this);
    this.taskDefinition = new TaskDefinitionMapper(this);
    this.service = new ServiceMapper(this);
    this.deployService = new DeployServiceRPC(this);
    this.invokeEcs = new AwsSdkInvoker('ecsClient', this);

    super.init();
  }
}
export const awsEcsFargateModule = new AwsEcsFargateModule();
