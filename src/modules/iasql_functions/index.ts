/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../interfaces';
import {
  IasqlApply,
  IasqlCommit,
  IasqlInstall,
  IasqlModulesList,
  IasqlPreview,
  IasqlPreviewApply,
  IasqlPreviewSync,
  IasqlSync,
  IasqlUninstall,
  IasqlRollback,
  IasqlBegin,
  IasqlGetErrors,
  IasqlGetSqlSince,
} from './rpcs';
import { IasqlHelp } from './rpcs/iasql_help';

/**
 * @internal
 */
export class IasqlFunctions extends ModuleBase {
  iasqlApply: IasqlApply;
  iasqlPreviewApply: IasqlPreviewApply;
  iasqlSync: IasqlSync;
  iasqlPreviewSync: IasqlPreviewSync;
  iasqlModulesList: IasqlModulesList;
  iasqlInstall: IasqlInstall;
  iasqlUninstall: IasqlUninstall;
  iasqlCommit: IasqlCommit;
  iasqlPreview: IasqlPreview;
  iasqlRollback: IasqlRollback;
  iasqlBegin: IasqlBegin;
  iasqlGetErrors: IasqlGetErrors;
  iasqlGetSqlSince: IasqlGetSqlSince;
  iasqlHelp: IasqlHelp;

  constructor() {
    super();
    this.iasqlApply = new IasqlApply(this);
    this.iasqlPreviewApply = new IasqlPreviewApply(this);
    this.iasqlSync = new IasqlSync(this);
    this.iasqlPreviewSync = new IasqlPreviewSync(this);
    this.iasqlModulesList = new IasqlModulesList(this);
    this.iasqlInstall = new IasqlInstall(this);
    this.iasqlUninstall = new IasqlUninstall(this);
    this.iasqlCommit = new IasqlCommit(this);
    this.iasqlPreview = new IasqlPreview(this);
    this.iasqlRollback = new IasqlRollback(this);
    this.iasqlBegin = new IasqlBegin(this);
    this.iasqlGetErrors = new IasqlGetErrors(this);
    this.iasqlGetSqlSince = new IasqlGetSqlSince(this);
    this.iasqlHelp = new IasqlHelp(this);
    super.loadBasics();
  }
}

/**
 * ```testdoc
 * basic_integration/commit.ts#basic begin, commit and preview functionality#Begin, commit and preview
 * basic_integration/rollback.ts#basic rollback functionality#Basic rollback functionality
 * common/get_sql_since.ts#iasql_get_sql_since functionality#iasql_get_sql_since functionality
 * ```
 */
export const iasqlFunctions = new IasqlFunctions();
