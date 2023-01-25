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
    this.project = new CodebuildProjectMapper(this);
    this.sourceCredentialsList = new SourceCredentialsListMapper(this);
    this.importSourceCredential = new ImportSourceCredentialRpc(this);
    this.buildList = new CodebuildBuildListMapper(this);
    this.startBuild = new StartBuildRPC(this);
    super.init();
  }
}

export const awsCodebuildModule = new AwsCodebuildModule();
