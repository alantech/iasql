import { ModuleBase } from '../interfaces';
import {
  CodebuildProjectMapper,
  SourceCredentialsImportMapper,
  SourceCredentialsListMapper,
  CodebuildBuildImportMapper,
  CodebuildBuildListMapper,
} from './mappers';

export class AwsCodebuildModule extends ModuleBase {
  /** @internal */
  project: CodebuildProjectMapper;

  /** @internal */
  sourceCredentialsList: SourceCredentialsListMapper;

  /** @internal */
  sourceCredentialsImport: SourceCredentialsImportMapper;

  /** @internal */
  buildImport: CodebuildBuildImportMapper;

  /** @internal */
  buildList: CodebuildBuildListMapper;

  constructor() {
    super();
    this.project = new CodebuildProjectMapper(this);
    this.sourceCredentialsList = new SourceCredentialsListMapper(this);
    this.sourceCredentialsImport = new SourceCredentialsImportMapper(this);
    this.buildImport = new CodebuildBuildImportMapper(this);
    this.buildList = new CodebuildBuildListMapper(this);
    super.init();
  }
}
export const awsCodebuildModule = new AwsCodebuildModule();
