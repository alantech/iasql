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
 * Method to visualize proposed changes for an ongoing IaSQL transaction to see how the database will update
 * the cloud with the new data model using the `iasql_preview` function which returns a virtual table of database records.
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
export class IasqlPreview extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.FAIL_IF_NOT_LOCKED;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  inputTable = {};
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
    description: 'Preview of the resources in the db to be modified on the next `commit`',
    sampleUsage: 'SELECT * FROM iasql_preview()',
  };

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = (await iasql.commit(dbId, true, ctx))?.rows ?? [];
    return res.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
