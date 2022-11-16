/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../../interfaces';
import { IasqlAuditLog, IasqlModule, IasqlTables } from './entity';

class IasqlPlatform extends ModuleBase {
  constructor() {
    super();
    super.init();
  }
  iasqlModule = IasqlModule;
  iasqlTables = IasqlTables;
  iasqlAuditLog = IasqlAuditLog;
}
export const iasqlPlatform = new IasqlPlatform();
