import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class IasqlBegin extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    message: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    await ctx.orm.query(`SELECT * FROM query_cron('disable');`);
    const message = 'Transaction started';
    // TODO: Find a way to set a timeout to init the cron again.
    // We can use the cron state job but we sould also need to look for the last time begin was called maybe?
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
