/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';

class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
  // TODO: here for testing purpose. To be delete it
  customCall = async () => {
    return JSON.stringify([{ result: "I have been called!" }]);
  };
}
export const iasqlFunctions = new IasqlFunctions();
