/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import { IasqlOperationType } from './entity';
import { ModuleBase } from '../../interfaces';

class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
