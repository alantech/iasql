import { Build, CodeBuild, ImportSourceCredentialsInput } from '@aws-sdk/client-codebuild';
import { ServerType } from '@aws-sdk/client-codebuild/dist-types/models/models_0';

import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
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

export class ImportSourceCredentialRpc extends RpcBase {
  /** @internal */
  module: AwsCodebuildModule;

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

  private makeError(message: string) {
    return [
      {
        arn: '',
        status: 'ERROR',
        message,
      },
    ];
  }

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
    if (!serverType) serverType = 'GITHUB';
    if (!authType) authType = 'PERSONAL_ACCESS_TOKEN';
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
