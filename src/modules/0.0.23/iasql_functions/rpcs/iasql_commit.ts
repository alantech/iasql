import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlCommit extends RpcBase {
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
    if (!openTransaction) {
      throw new Error('Cannot commit without calling iasql_begin first.');
    }
    const res = (await iasql.commit(dbId, false, ctx)).rows;
    await iasql.closeTransaction(ctx.orm);
    // Why do I need to do this nonsense???
    const outputTable = this.outputTable;
    return (
      res?.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof outputTable>) ?? []
    );
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
