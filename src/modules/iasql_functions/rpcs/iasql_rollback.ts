import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method to abort an IaSQL transaction if you want to discard the changes done since calling `iasql_begin` by
 * calling `iasql_rollback`. This will re-enable regular behaviour of IaSQL in which changes are propagated
 * both ways in an eventually consistent way without any special syntax other than
 * `SELECT/INSERT/UPDATE/DELETE` records normally.
 *
 * Returns following columns:
 * - action: The action issued in the db
 * - table_name: Table that was affected
 * - id: the ID of the generated change
 * - description: A description of the generated change
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_rollback();
 * ```
 *
 * @see https://iasql.com/docs/transaction/
 *
 */
export class IasqlRollback extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;

  /**
   * @internal
   */
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;

  /** @internal */
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const openTransaction = await iasql.isOpenTransaction(ctx.orm);
    if (!openTransaction) {
      throw new Error('Cannot rollback without calling iasql_begin first.');
    }
    const res = (await iasql.rollback(dbId, ctx)).rows;
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
