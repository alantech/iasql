import { IasqlFunctions } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

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

    for (const [functionName, documentation] of Object.entries(this.module.provides.functions)) {
      if (!!documentation.description && !!documentation.sample_usage)
        returnList.push({
          name: functionName,
          signature: documentation.signature,
          description: documentation.description,
          sample_usage: documentation.sample_usage,
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
