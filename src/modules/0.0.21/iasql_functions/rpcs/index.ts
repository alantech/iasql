import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class CustomCallRpc extends RpcBase {
  module: IasqlFunctions;
  name = 'custom_call';
  output = {
    response: 'varchar',
    args: 'json',
  } as const;
  call = async (ctx: Context, arg1: string): Promise<RpcResponseObject<typeof this.output>[]> => {
    return [{ response: 'I have been called!', args: `{ "arg1": "${arg1}" }` }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
