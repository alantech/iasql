import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcInput,
  RpcResponseObject,
} from '../../interfaces';
import * as iasql from '../iasql';

/**
 * Method that finishes a transaction. It is possible to perform changes to your cloud account synchronously by
 * temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL
 * transaction using the provided PostgreSQL function `iasql_begin`. This lets you batch, or stage, changes together and
 * then calling `iasql_commit` to mark the end of the transaction and propagate the changes from the database to the cloud account.
 *
 * @see https://iasql.com/docs/transaction
 *
 *
 */
export class IasqlCommit extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.FAIL_IF_NOT_LOCKED;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.UNLOCK_ALWAYS;
  /** @internal */
  inputTable: RpcInput = {
    message: {
      argType: 'varchar',
      default: null,
    },
  };
  /** @internal */
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;

  documentation = {
    description: 'Commit changes done to the database by creating, updating or deleting cloud resources',
    sampleUsage: 'SELECT * FROM iasql_commit()',
  };

  /** @internal */
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    commitMessage?: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = (await iasql.commit(dbId, false, ctx, false, undefined, commitMessage))?.rows ?? [];
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
