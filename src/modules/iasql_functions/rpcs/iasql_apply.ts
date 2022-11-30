import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject, TransactionModeEnum } from '../../interfaces';

export class IasqlApply extends RpcBase {
  transactionMode = TransactionModeEnum.NO_TRANSACTION;
  module: IasqlFunctions;
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
    throw new Error(`iasql_apply() has been deprecated in favor of iasql_commit()`);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
