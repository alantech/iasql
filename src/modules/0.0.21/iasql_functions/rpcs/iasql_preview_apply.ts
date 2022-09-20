import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlPreviewApply extends RpcBase {
  module: IasqlFunctions;
  name = 'iasql_preview_apply';
  output = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.output>[]> => {
    const applyRes = (await iasql.apply(dbId, true, ctx)).rows;
    return applyRes.map(rec => <RpcResponseObject<typeof this.output>>super.formatObjKeysToSnakeCase(rec));
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
