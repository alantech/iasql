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
 * Method to abort an IaSQL transaction if you want to discard the changes done since calling `iasql_begin` by
 * calling `iasql_rollback`. This will sync from your cloud and re-enable regular behaviour of IaSQL in which changes are propagated
 * both ways in an eventually consistent way without any special syntax other than
 * `SELECT/INSERT/UPDATE/DELETE` records normally.
 *
 * Returns following columns:
 * - action: The action issued in the db
 * - table_name: Table that was affected
 * - id: the ID of the generated change
 * - description: A description of the generated change
 *
 * @see https://iasql.com/docs/transaction/
 *
 */
export class IasqlRollback extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.FAIL_IF_NOT_LOCKED;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.UNLOCK_ALWAYS;
  /** @internal */
  inputTable = {
    force: { argType: 'boolean', default: 'false', rawDefault: true },
  };
  /**
   * @internal
   */
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;

  documentation = {
    description: 'Rollback changes done to the database by synchronizing cloud resources',
    sampleUsage: 'SELECT * FROM iasql_rollback()',
  };

  /** @internal */
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    force?: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = (await iasql.rollback(dbId, ctx, force?.toLowerCase() === 'true')).rows;
    return (
      res?.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>) ?? []
    );
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
