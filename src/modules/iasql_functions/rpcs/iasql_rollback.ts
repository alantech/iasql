import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';
import * as iasql from '../iasql';

export class IasqlRollback extends RpcBase {
  module: IasqlFunctions;
  preTransactionCheck = PreTransactionCheck.FAIL_IF_NOT_LOCKED;
  postTransactionCheck = PostTransactionCheck.UNLOCK_IF_SUCCEED;
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
