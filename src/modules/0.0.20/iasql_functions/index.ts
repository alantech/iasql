/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
import { CustomCallRpc } from './rpcs';

export class IasqlFunctions extends ModuleBase {
  customCall: CustomCallRpc;
  constructor() {
    super();
    this.sql = {
      afterInstallSqlPath: 'sql/create_fns.sql',
      beforeUninstallSqlPath: 'sql/drop_fns.sql',
    };
    this.customCall = new CustomCallRpc(this);
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
