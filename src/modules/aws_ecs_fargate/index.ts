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

/**
 * ```testdoc
 * modules/aws-ecs-integration.ts#ECS Integration Testing#Manage ECS
 * modules/aws-ecs-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr private repos
 * modules/aws-ecs-pub-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr public repos
 *
 * ```
 */
export const awsEcsFargateModule = new AwsEcsFargateModule();
