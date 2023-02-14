import { ModuleBase } from '../interfaces';
import { QueueMapper } from './mappers';

export class AwsSqsModule extends ModuleBase {
  /** @internal */
  queue: QueueMapper;

  constructor() {
    super();
    this.queue = new QueueMapper(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-sqs-integration.ts#AwsSQS Integration Testing#Manage SQS
 * ```
 */
export const awsSqsModule = new AwsSqsModule();
