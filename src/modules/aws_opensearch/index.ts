import { ModuleBase } from '../interfaces';
import { DomainMapper } from './mappers/domain';

export class AwsOpenSearchModule extends ModuleBase {
  /** @internal */
  domain: DomainMapper;

  constructor() {
    super();
    // Mappers
    this.domain = new DomainMapper(this);
    // RPCs
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-opensearch-integration.ts#Opensearch Integration Testing#Manage ElasticSearch
 * ```
 */
export const awsOpensearch = new AwsOpenSearchModule();