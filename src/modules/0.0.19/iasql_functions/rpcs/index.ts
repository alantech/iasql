import { IasqlFunctions } from '..';
import { Context, RpcBase } from '../../../interfaces';

export class CustomCallRpc extends RpcBase {
  async customCall(ctx: Context, arg1: string, arg2: string) {
    return JSON.stringify([{ result: 'I have been called!', arg1, arg2, memo: ctx.memo }]);
  }

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    this.name = 'custom_call';
    this.call = this.customCall;
    super.init();
  }
}
