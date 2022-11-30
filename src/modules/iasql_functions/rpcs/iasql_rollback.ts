import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject, TransactionModeEnum } from '../../interfaces';
import * as iasql from '../iasql';

export class IasqlRollback extends RpcBase {
  module: IasqlFunctions;
  transactionMode = TransactionModeEnum.FAIL_IF_NO_TRANSACTION;
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
    // const openTransaction = await iasql.isOpenTransaction(ctx.orm);
    // if (!openTransaction) {
    //   throw new Error('Cannot rollback without calling iasql_begin first.');
    // }
    const res = (await iasql.rollback(dbId, ctx)).rows;
    // await iasql.closeTransaction(ctx.orm);
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
