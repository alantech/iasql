/* THIS MODULE IS A PURE SQL MODULE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE WITH MAPPERS */
import { ModuleBase } from '../interfaces';

class AwsEcsSimplified extends ModuleBase {
  constructor() {
    super();
    super.loadBasics();
  }
}

/**
 * ```testdoc
 * modules/aws-ecs-simplified-integration.ts#ECS Simplified Integration Testing#Code examples
 *
 * ```
 */
export const ecsSimplified = new AwsEcsSimplified();
