import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method that finishes a transaction. It is possible to perform changes to your cloud account synchronously by
 * temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL
 * transaction using the provided PostgreSQL function `iasql_begin`. This lets you batch, or stage, changes together and
 * then calling `iasql_commit` to mark the end of the transaction and propagate the changes from the database to the cloud account.
 *
 * @see http://localhost:3000/docs/transaction
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_begin();
 * ```
 *
 * @see https://iasql.com/docs/function/
 *
 */
export class IasqlCommit extends RpcBase {
  /** @internal */
  module: IasqlFunctions;

  /** @internal */
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;

  /** @internal */
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const openTransaction = await iasql.isOpenTransaction(ctx.orm);
    if (!openTransaction) {
      throw new Error('Cannot commit without calling iasql_begin first.');
    }
    const res = (await iasql.commit(dbId, dbUser, false, ctx)).rows;
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
