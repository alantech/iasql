/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
import { CustomCallRpc } from './rpcs';

export class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    this.rpc = {
      customCall: new CustomCallRpc(this),
    };
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
