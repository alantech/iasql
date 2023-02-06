import { ModuleBase } from '../interfaces';
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

  constructor() {
    super();
    // Mappers
    this.cluster = new ClusterMapper(this);
    this.taskDefinition = new TaskDefinitionMapper(this);
    this.service = new ServiceMapper(this);
    // RPCs
    this.deployService = new DeployServiceRPC(this);

    super.init();
  }
}
export const awsEcsFargateModule = new AwsEcsFargateModule();
