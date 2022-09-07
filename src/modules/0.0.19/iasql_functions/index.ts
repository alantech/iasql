/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { readFileSync } from 'fs';
import { ModuleBase } from '../../interfaces';
import { IasqlOperationType } from './entity';

class IasqlFunctions extends ModuleBase {
  constructor() {
    super();
    this.sql = {
      afterInstall: readFileSync(`${__dirname}/sql/create_fns.sql`, 'utf8'),
      beforeUninstall: readFileSync(`${__dirname}/sql/drop_fns.sql`, 'utf8')
    }
    super.init();
  }
  iasqlOperationType = IasqlOperationType;
}
export const iasqlFunctions = new IasqlFunctions();
