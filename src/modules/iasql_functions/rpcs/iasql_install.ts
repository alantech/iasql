import { IasqlFunctions } from '..';
import { TypeormWrapper } from '../../../services/typeorm';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method to install the IaSQL modules provided by the engine
 *
 * Returns following columns:
 * - module_name: Name of the module that was installed
 * - created_table_name: Name of the associated table that was created
 * - record_count: Total of registers added
 *
 * Accepts the following parameters:
 * - list of modules to install
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_install('aws_ec2');
 * ```
 *
 * @see https://iasql.com/docs/function/
 *
 */
export class IasqlInstall extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;

  /**
   * @internal
   */
  outputTable = {
    module_name: 'varchar',
    created_table_name: 'varchar',
    record_count: 'integer',
  } as const;
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
    ...params: string[]
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    await iasql.maybeOpenTransaction(ctx.orm);
    try {
      await iasql.install(params, dbId, dbUser, false, false, ctx);
    } catch (e) {
      throw e;
    } finally {
      await iasql.closeTransaction(ctx.orm);
    }
    const query = `
      select
          m.name as module_name,
          t.table as created_table_name,
          (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
      from iasql_module as m
      inner join iasql_tables as t on m.name = t.module
      inner join (select unnest(array[${params.map(mod => `'${mod}'`).join(',')}]) as module) as mo on true
      where left(m.name, length(mo.module)) = mo.module;
    `;
    const modulesInstalled = await (ctx.orm as TypeormWrapper).query(query);
    return modulesInstalled;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
