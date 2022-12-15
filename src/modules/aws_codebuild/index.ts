import { ModuleBase } from '../interfaces';
import {
  CodebuildProjectMapper,
  SourceCredentialsImportMapper,
  SourceCredentialsListMapper,
  CodebuildBuildListMapper,
} from './mappers';
import { StartBuildRPC } from './rpcs';

export class AwsCodebuildModule extends ModuleBase {
  /** @internal */
  project: CodebuildProjectMapper;

  /** @internal */
  sourceCredentialsList: SourceCredentialsListMapper;

  /** @internal */
  sourceCredentialsImport: SourceCredentialsImportMapper;
  startBuild: StartBuildRPC;
  buildList: CodebuildBuildListMapper;

  constructor() {
    super();
    this.project = new CodebuildProjectMapper(this);
    this.sourceCredentialsList = new SourceCredentialsListMapper(this);
    this.sourceCredentialsImport = new SourceCredentialsImportMapper(this);
    this.buildList = new CodebuildBuildListMapper(this);
    this.startBuild = new StartBuildRPC(this);
    super.init();
  }
}
export const awsCodebuildModule = new AwsCodebuildModule();
