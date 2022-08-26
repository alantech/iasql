/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */

import { ModuleBase } from '../../interfaces';
import { IasqlModule, IasqlTables } from './entity';

class IasqlPlatform extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  iasqlModule = IasqlModule;
  iasqlTables = IasqlTables;
}
export const iasqlPlatform = new IasqlPlatform();
