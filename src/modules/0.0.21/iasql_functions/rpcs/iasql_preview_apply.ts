import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlPreviewApply extends RpcBase {
  module: IasqlFunctions;
  name = 'iasql_preview_apply';
  output = {
    preview_apply: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.output>[]> => {
    return [{ preview_apply: await iasql.apply(dbId, true) }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
