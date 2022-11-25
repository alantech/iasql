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
    let message: string;
    try {
      const [isRunning, statusRes] = await Promise.all([
        isCommitRunning(ctx.orm),
        ctx.orm.query(`SELECT * FROM query_cron('status');`),
      ]);
      // if there's a commit/rollback running or the cron is inactive we do not continue
      if (isRunning || (statusRes?.length && statusRes[0].query_cron === 'f')) {
        throw new Error('Another transaction is open. Close it before opening a new one.');
      }
      await ctx.orm.query(`SELECT * FROM query_cron('disable');`);
      message = 'Transaction started';
    } catch (e) {
      throw e;
    } finally {
      setTimeout(
        async (currentDate: Date) => {
          if (ctx.orm) {
            const [isRunning, statusRes, lastBeginRes] = await Promise.all([
              isCommitRunning(ctx.orm),
              ctx.orm.query(`SELECT * FROM query_cron('status');`),
              ctx.orm.query(`
                SELECT * FROM iasql_rpc WHERE method_name = 'iasqlBegin' ORDER BY start_date DESC LIMIT 1;
              `),
            ]);
            if (!isRunning && statusRes[0]?.query_cron === 'f' && lastBeginRes[0]?.start_date < currentDate) {
              // If these conditions happen it means the transaction stayed open and we need to enable again the cron
              await ctx.orm.query(`SELECT * FROM query_cron('enable');`);
            }
          }
        },
        1000 * 60 * 30, // Execute this after 30 min
        new Date(),
      );
    }
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
