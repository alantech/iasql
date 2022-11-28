import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { isCommitRunning } from '../iasql';

export class IasqlUnlockTransaction extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    message: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    let message: string;
    const [isRunning, statusRes, beginInTheLast30Min] = await Promise.all([
      isCommitRunning(ctx.orm),
      ctx.orm.query(`SELECT * FROM query_cron('status');`),
      ctx.orm.query(`
        SELECT *
        FROM iasql_rpc
        WHERE method_name = 'iasqlBegin' AND start_date >= (now() - interval '30 minutes')
        ORDER BY start_date DESC;
      `),
    ]);
    if (!isRunning && statusRes[0]?.query_cron === 'f' && !beginInTheLast30Min.length) {
      // If these conditions happen it means the transaction stayed open and we need to enable again the cron
      await ctx.orm.query(`SELECT * FROM query_cron('enable');`);
      message = 'Transaction unlocked';
    }
    message = 'Transaction in progress';
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
