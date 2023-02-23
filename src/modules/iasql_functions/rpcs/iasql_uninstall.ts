import format from 'pg-format';

import { IasqlFunctions } from '..';
import { TypeormWrapper } from '../../../services/typeorm';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method to uninstall the IaSQL modules provided by the engine
 *
 * Returns following columns:
 * - module_name: Name of the module that was uninstalled
 * - dropped_table_name: Name of the associated table that was deleted
 * - record_count: Total of registers deleted
 *
 * Accepts the following parameters:
 * - list of modules to uninstall
 *
 * @see https://iasql.com/docs/module/
 *
 */
export class IasqlUninstall extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;

  /**
   * @internal
   */
  outputTable = {
    module_name: 'varchar',
    dropped_table_name: 'varchar',
    record_count: 'integer',
  } as const;

  documentation = {
    description: 'Uninstall modules in the hosted db',
    sampleUsage: "SELECT * FROM iasql_uninstall('aws_vpc', 'aws_ec2')",
  };

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    ...params: string[]
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // Built-in iasql_* modules not allowed to be uninstalled
    params = params.filter(mod => !['iasql_functions', 'iasql_platform'].includes(mod));
    const query = `
      select
          m.name as module_name,
          t.table as dropped_table_name,
          (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
      from iasql_module as m
      inner join iasql_tables as t on m.name = t.module
      inner join (select unnest(array[${format('%L', params)}]) as module) as mo on true
      where left(m.name, length(mo.module)) = mo.module;
    `;
    const modulesUninstalled = await (ctx.orm as TypeormWrapper).query(query);
    await iasql.uninstall(params, dbId);
    return modulesUninstalled;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
