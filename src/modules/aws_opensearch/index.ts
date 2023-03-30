import { ModuleBase } from '../interfaces';
import { DomainMapper } from './mappers/domain';

export class AwsOpenSearchModule extends ModuleBase {
  /** @internal */
  domain: DomainMapper;

  constructor() {
    super();
    // Mappers
    this.domain = new DomainMapper(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-opensearch-integration.ts#Opensearch Integration Testing#Manage OpenSearch
 * ```
 */
export const awsOpensearch = new AwsOpenSearchModule();
