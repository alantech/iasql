import { IasqlFunctions } from '..';
import { Context, RpcBase } from '../../../interfaces';

export class CustomCallRpc extends RpcBase {
  module: IasqlFunctions;
  name = 'custom_call';
  call = async (ctx: Context, arg1: string, arg2: string) => {
    return [{ result: 'I have been called!', arg1, arg2, memo: ctx.memo }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
