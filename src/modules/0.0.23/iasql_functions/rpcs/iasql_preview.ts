import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlPreview extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const openTransaction = await iasql.isOpenTransaction(ctx.orm);
    // If there is not an open transaction but the call is being done by the engine itself (for example  with the cron job we let it pass)
    if (!openTransaction) {
      throw new Error('Cannot preview without calling iasql_begin first.');
    }
    const res = (await iasql.commit(dbId, true, ctx)).rows;
    return res.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
