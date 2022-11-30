import { IasqlFunctions } from '..';
import { TypeormWrapper } from '../../../services/typeorm';
import { Context, RpcBase, RpcResponseObject, TransactionModeEnum } from '../../interfaces';
import * as iasql from '../iasql';

export class IasqlUninstall extends RpcBase {
  module: IasqlFunctions;
  transactionMode = TransactionModeEnum.INNER_TRANSACTION;
  outputTable = {
    module_name: 'varchar',
    dropped_table_name: 'varchar',
    record_count: 'integer',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    ...params: string[]
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const query = `
      select
          m.name as module_name,
          t.table as dropped_table_name,
          (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.table), FALSE, TRUE, '')))[1]::text::int AS record_count
      from iasql_module as m
      inner join iasql_tables as t on m.name = t.module
      inner join (select unnest(array[${params.map(mod => `'${mod}'`).join(',')}]) as module) as mo on true
      where left(m.name, length(mo.module)) = mo.module;
    `;
    const modulesUninstalled = await (ctx.orm as TypeormWrapper).query(query);
    // await iasql.maybeOpenTransaction(ctx.orm);
    // try {
    await iasql.uninstall(params, dbId);
    // } catch (e) {
    //   throw e;
    // } finally {
    //   await iasql.closeTransaction(ctx.orm);
    // }
    return modulesUninstalled;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
