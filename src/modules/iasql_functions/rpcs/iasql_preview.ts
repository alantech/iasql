import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import * as iasql from '../iasql';

export class IasqlPreview extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = (await iasql.commit(dbId, dbUser, true, ctx)).rows;
    return res.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>);
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
