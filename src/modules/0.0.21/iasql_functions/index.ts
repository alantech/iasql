/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
import { IasqlApply, IasqlPreviewApply } from './rpcs';

export class IasqlFunctions extends ModuleBase {
  iasqlApply: IasqlApply;
  iasqlPreviewApply: IasqlPreviewApply;
  constructor() {
    super();
    this.sql = {
      afterInstallSqlPath: 'sql/create_fns.sql',
      beforeUninstallSqlPath: 'sql/drop_fns.sql',
    };
    this.iasqlApply = new IasqlApply(this);
    this.iasqlPreviewApply = new IasqlPreviewApply(this);
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
