import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method to create, delete or update the cloud resources in a hosted db
 *
 * Returns following columns:
 * - action: The action issued in the db
 * - table_name: Table that was affected
 * - id: the ID of the generated change
 * - description: A description of the generated change
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_apply();
 * ```
 *
 * @see https://iasql.com/docs/function/
 *
 */
export class IasqlApply extends RpcBase {
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
