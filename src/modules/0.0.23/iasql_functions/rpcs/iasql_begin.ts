import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { isCommitRunning } from '../iasql';

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
    const [isRunning, statusRes] = await Promise.all([
      isCommitRunning(ctx.orm),
      ctx.orm.query(`SELECT * FROM query_cron('status');`),
    ]);
    // if there's a commit/rollback running or the cron is inactive we do not continue
    if (isRunning || (statusRes?.length && statusRes[0].query_cron === 'f')) {
      throw new Error('Another transaction is open. Close it before opening a new one.');
    }
    await ctx.orm.query(`SELECT * FROM query_cron('disable');`);
    const message = 'Transaction started';
    // TODO: Find a way to set a timeout to init the cron again.
    // We can use the cron state job but we should also need to look for the last time begin was called maybe?
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
