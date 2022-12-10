import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

/**
 * @internal
 */
export class IasqlPreview extends RpcBase {
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
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = (await iasql.commit(dbId, true, ctx)).rows;
    return res.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
