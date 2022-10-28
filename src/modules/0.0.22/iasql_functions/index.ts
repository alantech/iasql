/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
import {
  IasqlApply,
  IasqlCommit,
  IasqlInstall,
  IasqlModulesList,
  IasqlPreviewApply,
  IasqlPreviewSync,
  IasqlSync,
  IasqlUninstall,
  IasqlUpgrade,
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
    super.init();
  }
  // ! DEPRECATED
  // TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
