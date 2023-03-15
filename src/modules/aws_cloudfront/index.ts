import { ModuleBase } from '../interfaces';
import { DistributionMapper } from './mappers';

export class AwsCloudfrontModule extends ModuleBase {
  distribution: DistributionMapper;

  constructor() {
    super();
    this.distribution = new DistributionMapper(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-cloudfront-integration.ts#Cloudfront Integration Testing#Manage CloudFront
 * ```
 */
export const awsCloudfrontModule = new AwsCloudfrontModule();
