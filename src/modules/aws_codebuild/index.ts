import { ModuleBase } from '../interfaces';
import { CodebuildProjectMapper, SourceCredentialsListMapper, CodebuildBuildListMapper } from './mappers';
import { StartBuildRPC, ImportSourceCredentialRpc } from './rpcs';

export class AwsCodebuildModule extends ModuleBase {
  /** @internal */
  project: CodebuildProjectMapper;

  /** @internal */
  sourceCredentialsList: SourceCredentialsListMapper;

  /** @internal */
  importSourceCredential: ImportSourceCredentialRpc;
  startBuild: StartBuildRPC;
  buildList: CodebuildBuildListMapper;

  constructor() {
    super();
    // Mappers
    this.project = new CodebuildProjectMapper(this);
    this.sourceCredentialsList = new SourceCredentialsListMapper(this);
    this.buildList = new CodebuildBuildListMapper(this);
    // RPCs
    this.importSourceCredential = new ImportSourceCredentialRpc(this);
    this.startBuild = new StartBuildRPC(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-codebuild-integration.ts#AwsCodebuild Integration Testing#Code examples
 * ```
 */
export const awsCodebuildModule = new AwsCodebuildModule();
