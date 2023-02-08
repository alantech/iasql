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
 * Method to list all the installed modules
 *
 * Returns following columns:
 * - module_name: Name of the module that was installed
 * - module_version: Version of the modules that was installed
 * - dependencies: complex type representing the dependencies for the module
 *
 *
 *
 * @see https://iasql.com/docs/module/
 *
 */
export class IasqlModulesList extends RpcBase {
  /**
   * @internal
   */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /**
   * @internal
   */
  outputTable = {
    module_name: 'varchar',
    module_version: 'varchar',
    dependencies: 'json',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = await iasql.modules(true, false, dbId);
    return res.map(rec => {
      const updatedRec = {
        moduleName: rec.moduleName,
        moduleVersion: rec.moduleVersion,
        dependencies: JSON.stringify(rec.dependencies),
      };
      return super.formatObjKeysToSnakeCase(updatedRec) as RpcResponseObject<typeof this.outputTable>;
    });
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
