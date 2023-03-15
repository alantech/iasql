import { ModuleBase } from '../interfaces';
import { GraphqlApiMapper } from './mappers';

export class AwsAppsyncModule extends ModuleBase {
  graphqlApi: GraphqlApiMapper;

  constructor() {
    super();
    this.graphqlApi = new GraphqlApiMapper(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-appsync-integration.ts#App Sync Integration Testing#Manage GraphQL
 * ```
 */
export const awsAppsyncModule = new AwsAppsyncModule();
