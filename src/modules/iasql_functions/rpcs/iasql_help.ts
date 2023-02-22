import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';
import { getInstalledModules } from './iasql_get_sql_since';

/**
 * Method to list IaSQL functions, their description and usage example
 *
 * Returns following columns:
 * - name: function name
 * - signature: signature used to call the function
 * - description: a description on what the function does
 * - sample_usage: sample usage of the function
 *
 */
export class IasqlHelp extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  inputTable = {};
  /**
   * @internal
   */
  outputTable = {
    module: 'varchar',
    name: 'varchar',
    signature: 'varchar',
    description: 'varchar',
    sample_usage: 'varchar',
  } as const;
  documentation = {
    description:
      'Returns a list of RPCs and Postgres functions available with description and sample usage (if available)',
    sampleUsage: "SELECT * FROM iasql_help() WHERE module = 'iasql_functions'",
  };
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const returnList: RpcResponseObject<typeof this.outputTable>[] = [];
    for (const module of await getInstalledModules(ctx.orm)) {
      Object.entries(module.provides?.functions ?? {}).map(([functionName, documentation]) =>
        returnList.push({
          module: module.name,
          name: functionName,
          signature: documentation.signature,
          description: documentation.description ?? '',
          sample_usage: documentation.sample_usage ?? '',
        }),
      );
    }
    return returnList;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
