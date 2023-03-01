import { ModuleBase } from '../interfaces';

export class AwsOpenSearchModule extends ModuleBase {
  /** @internal */
  bucketWebsite: BucketWebsiteMapper;

  constructor() {
    super();
    // Mappers
    this.bucketWebsite = new BucketWebsiteMapper(this);
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
