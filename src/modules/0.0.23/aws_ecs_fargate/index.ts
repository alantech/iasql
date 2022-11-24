import { ModuleBase } from '../../interfaces';
import { ClusterMapper, ServiceMapper, TaskDefinitionMapper } from './mappers';
import { DeployServiceRPC } from './rpcs';

export class AwsEcsFargateModule extends ModuleBase {
  cluster: ClusterMapper;
  taskDefinition: TaskDefinitionMapper;
  service: ServiceMapper;
  deployService: DeployServiceRPC;

  constructor() {
    super();
    this.cluster = new ClusterMapper(this);
    this.taskDefinition = new TaskDefinitionMapper(this);
    this.service = new ServiceMapper(this);
    this.deployService = new DeployServiceRPC(this);

    super.init();
  }
}
export const awsEcsFargateModule = new AwsEcsFargateModule();
