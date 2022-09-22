import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlModulesList extends RpcBase {
  module: IasqlFunctions;
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
