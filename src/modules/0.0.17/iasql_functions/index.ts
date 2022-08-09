/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import * as metadata from './module.json'
import { IasqlOperationType, } from './entity'
import { ModuleBase, } from '../../interfaces'

class IasqlFunctions extends ModuleBase {
  constructor() { super(); super.init(); }
  dirname = __dirname;
  dependencies = metadata.dependencies;
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();