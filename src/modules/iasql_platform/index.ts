/* THIS MODULE IS A SPECIAL SNOWFLAKE. DON'T LOOK AT IT FOR HOW TO WRITE A REAL MODULE */
import { ModuleBase } from '../interfaces';
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

/**
 * ```testdoc
 * common/get_sql_since.ts#iasql_get_sql_since functionality#iasql_audit_log functionality
 * common/all-modules-have-tables.ts#Every module installed need to have at least a table#List tables functionality
 * ```
 */
export const iasqlPlatform = new IasqlPlatform();
