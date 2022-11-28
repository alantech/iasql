/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
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
  IasqlUpgrade,
  IasqlRollback,
  IasqlBegin,
  IasqlUnlockTransaction,
} from './rpcs';

export class IasqlFunctions extends ModuleBase {
  iasqlApply: IasqlApply;
  iasqlPreviewApply: IasqlPreviewApply;
  iasqlSync: IasqlSync;
  iasqlPreviewSync: IasqlPreviewSync;
  iasqlModulesList: IasqlModulesList;
  iasqlInstall: IasqlInstall;
  iasqlUninstall: IasqlUninstall;
  iasqlUpgrade: IasqlUpgrade;
  iasqlCommit: IasqlCommit;
  iasqlPreview: IasqlPreview;
  iasqlRollback: IasqlRollback;
  iasqlBegin: IasqlBegin;
  iasqlUnlockTransaction: IasqlUnlockTransaction;

  constructor() {
    super();
    this.iasqlApply = new IasqlApply(this);
    this.iasqlPreviewApply = new IasqlPreviewApply(this);
    this.iasqlSync = new IasqlSync(this);
    this.iasqlPreviewSync = new IasqlPreviewSync(this);
    this.iasqlModulesList = new IasqlModulesList(this);
    this.iasqlInstall = new IasqlInstall(this);
    this.iasqlUninstall = new IasqlUninstall(this);
    this.iasqlUpgrade = new IasqlUpgrade(this);
    this.iasqlCommit = new IasqlCommit(this);
    this.iasqlPreview = new IasqlPreview(this);
    this.iasqlRollback = new IasqlRollback(this);
    this.iasqlBegin = new IasqlBegin(this);
    this.iasqlUnlockTransaction = new IasqlUnlockTransaction(this);
    super.init();
  }
  // ! DEPRECATED
  // TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
