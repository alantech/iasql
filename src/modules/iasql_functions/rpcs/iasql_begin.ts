import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method that starts a transaction. It marks the start of a set
 * of changes that can be then applied into the database.
 *
 * @see http://localhost:3000/docs/next/apply-and-sync/
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_begin();
 * ```
 *
 * @see https://iasql.com/docs/function/
 *
 */
export class IasqlBegin extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.WAIT_FOR_LOCK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  outputTable = {
    message: 'varchar',
  } as const;

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const message = 'Transaction started';
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
