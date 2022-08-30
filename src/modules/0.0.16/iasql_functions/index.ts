/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';
import * as metadata from './module.json';

class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  dirname = __dirname;
  dependencies = metadata.dependencies;
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
