/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { Context, ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';

class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
  // TODO: here for testing purpose. To be delete it
  // TODO: this also will be refactored using an rpc subtype in ModuleBase
  async customCall(ctx: Context, arg1: string, arg2: string) {
    return JSON.stringify([{ result: 'I have been called!', arg1, arg2, ctx }]);
  }
}
export const iasqlFunctions = new IasqlFunctions();
