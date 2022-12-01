import { IasqlFunctions } from '..';
import { Context, PostTransactionCheck, PreTransactionCheck, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

export class IasqlBegin extends RpcBase {
  module: IasqlFunctions;
  preTransactionCheck = PreTransactionCheck.WAIT_FOR_LOCK;
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  outputTable = {
    message: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // await iasql.maybeOpenTransaction(ctx.orm);
    const message = 'Transaction started';
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
