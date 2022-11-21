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
    let conn: any;
    let message: string;
    try {
      await ctx.orm.query(`SELECT * FROM query_cron('disable');`);
      message = 'Transaction started';
      // TODO: Find a way to set a timeout to init the cron again.
      // We can use the cron state job but we sould also need to look for the last time begin was called maybe?
    } catch (e: any) {
      message = `An error has occured: ${e.message ?? 'Unknown error'}`;
    } finally {
      conn?.close();
    }
    return [{ message }];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
