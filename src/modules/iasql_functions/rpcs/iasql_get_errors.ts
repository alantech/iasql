import { IasqlFunctions } from '..';
import { TypeormWrapper } from '../../../services/typeorm';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method to list the error messages produced in a transaction by `iasql_commit` or `iasql_rollback`
 *
 * @see https://iasql.com/docs/transaction
 *
 * Returns following columns:
 * - ts: Error message timestamp
 * - message: Error message
 *
 *
 */
export class IasqlGetErrors extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;
  /**
   * @internal
   */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /**
   * @internal
   */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  inputTable = {};
  /**
   * @internal
   */
  outputTable = {
    ts: 'timestamp with time zone',
    message: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const query = `
      select ts, message
      from iasql_audit_log
      where change_type = 'ERROR'
      order by ts desc limit 500;
    `;
    const errors = await (ctx.orm as TypeormWrapper).query(query);
    return errors;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
