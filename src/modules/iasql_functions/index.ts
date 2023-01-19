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
} from './rpcs';

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
    super.loadBasics();
  }
}

/**
 * @internal
 */
export const iasqlFunctions = new IasqlFunctions();
