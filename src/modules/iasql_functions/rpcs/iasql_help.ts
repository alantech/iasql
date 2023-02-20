import _ from 'lodash';
import { snakeCase } from 'typeorm/util/StringUtils';



import { IasqlFunctions } from '..';
import { Context, PostTransactionCheck, PreTransactionCheck, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';


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
    name: 'varchar',
    signature: 'varchar',
    description: 'varchar',
    sample_usage: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const returnList = [];

    const iasqlFunctionsRpcs = Object.entries(this.module)
      .filter(([, m]: [string, any]) => m instanceof RpcBase)
      .filter(([, m]) => _.has(m, 'helpDescription') && _.has(m, 'helpSampleUsage'));

    for (const [rpcName, rpc] of iasqlFunctionsRpcs) {
      const signature = [];
      for (const [k, v] of Object.entries(rpc.inputTable as RpcInput)) {
        if (typeof v === 'string') signature.push(`${snakeCase(k)} ${v}`);
        else {
          if (v.variadic) signature.push(`VARIADIC ${v.argType}`);
          else signature.push(`${snakeCase(k)} ${v.argType}`);
        }
      }
      returnList.push({
        name: snakeCase(rpcName),
        signature: signature.join(', '),
        description: rpc.helpDescription,
        sample_usage: rpc.helpSampleUsage,
      });
    }

    return returnList;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}