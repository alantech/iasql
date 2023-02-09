import { CodeBuild, ImportSourceCredentialsInput } from '@aws-sdk/client-codebuild';

import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';
import { AwsCodebuildModule } from '../index';

export enum ValidServerTypes {
  BITBUCKET = 'BITBUCKET',
  GITHUB = 'GITHUB',
  GITHUB_ENTERPRISE = 'GITHUB_ENTERPRISE',
}

export enum ValidAuthTypes {
  BASIC_AUTH = 'BASIC_AUTH',
  OAUTH = 'OAUTH',
  PERSONAL_ACCESS_TOKEN = 'PERSONAL_ACCESS_TOKEN',
}

/**
 * Method for importing a credentials used for pulling sources in codebuild
 *
 * Returns following columns:
 *
 * - arn: the aws resource name for the credential saved
 *
 * - status: OK if the build was started successfully
 *
 * - message: Error message in case of failure
 *
 * @see https://docs.aws.amazon.com/cli/latest/reference/codebuild/import-source-credentials.html
 *
 */
export class ImportSourceCredentialRpc extends RpcBase {
  /** @internal */
  module: AwsCodebuildModule;

  /** @internal */
  inputTable: RpcInput = {
    region: 'varchar',
    token: 'varchar',
    serverType: { argType: 'varchar', default: 'GITHUB' },
    authType: { argType: 'varchar', default: 'PERSONAL_ACCESS_TOKEN' },
  };

  /** @internal */
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /** @internal */
  importSourceCredentials = crudBuilderFormat<CodeBuild, 'importSourceCredentials', string | undefined>(
    'importSourceCredentials',
    input => input,
    res => res?.arn,
  );

  /** @internal */
  private makeError(message: string) {
    return [
      {
        arn: '',
        status: 'ERROR',
        message,
      },
    ];
  }

  /** @internal */
  private makeSuccess(arn: string) {
    return [
      {
        arn,
        status: 'SUCCESS',
        message: '',
      },
    ];
  }

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    region: string,
    token: string,
    serverType: string,
    authType: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!(serverType in ValidServerTypes))
      return this.makeError(`serverType must be one of ${Object.keys(ValidServerTypes).join(', ')}`);
    if (!(authType in ValidAuthTypes))
      return this.makeError(`authType must be one of ${Object.keys(ValidAuthTypes).join(', ')}`);

    const client = (await ctx.getAwsClient(region)) as AWS;
    const input: ImportSourceCredentialsInput = {
      token,
      serverType,
      authType,
    };
    const arn = await this.importSourceCredentials(client.cbClient, input);
    if (!arn) return this.makeError('Error importing source credentials');
    return this.makeSuccess(arn);
  };

  constructor(module: AwsCodebuildModule) {
    super();
    this.module = module;
    super.init();
  }
}
