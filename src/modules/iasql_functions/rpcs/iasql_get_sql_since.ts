import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method that generates SQL from the audit log from a given point in time.
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_get_sql_since();
 * ```
 *
 */
export class IasqlGetSqlSince extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  outputTable = {
    sql: 'varchar',
  } as const;

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sql = '';
    return [{ sql }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
