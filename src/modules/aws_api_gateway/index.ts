import { ModuleBase } from '../interfaces';
import { ApiMapper } from './mappers';

export class AwsApiGatewayModule extends ModuleBase {
  api: ApiMapper;

  constructor() {
    super();
    this.api = new ApiMapper(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-api-gateway-integration.ts#API Gateway Integration Testing#Manage API gateway
 * ```
 */
export const awsApiGatewayModule = new AwsApiGatewayModule();
