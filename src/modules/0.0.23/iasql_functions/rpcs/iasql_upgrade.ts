import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlUpgrade extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    message: 'varchar',
  } as const;
  call = async (
    dbId: string,
    dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const res = await iasql.upgrade(dbId, dbUser, ctx);
    return [{ message: res }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
