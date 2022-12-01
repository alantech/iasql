import { IasqlFunctions } from '..';
import { Context, PostTransactionCheck, PreTransactionCheck, RpcBase, RpcResponseObject } from '../../interfaces';

export class IasqlSync extends RpcBase {
  module: IasqlFunctions;
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    throw new Error(`iasql_sync() has been deprecated in favor of iasql_commit()`);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
