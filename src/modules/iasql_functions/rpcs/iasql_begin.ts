import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
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
  outputTable = {
    message: 'varchar',
  } as const;

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    await iasql.maybeOpenTransaction(ctx.orm);
    const message = 'Transaction started';
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
