import { ModuleBase } from '../../interfaces';
import { ClusterMapper, ServiceMapper, TaskDefinitionMapper } from './mappers';

export class AwsEcsFargateModule extends ModuleBase {
  cluster: ClusterMapper;
  taskDefinition: TaskDefinitionMapper;
  service: ServiceMapper;

  constructor() {
    super();
    this.cluster = new ClusterMapper(this);
    this.taskDefinition = new TaskDefinitionMapper(this);
    this.service = new ServiceMapper(this);
    super.init();
  }
}
export const awsEcsFargateModule = new AwsEcsFargateModule();
