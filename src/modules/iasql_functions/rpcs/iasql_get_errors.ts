import { IasqlFunctions } from '..';
import { TypeormWrapper } from '../../../services/typeorm';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

export class IasqlGetErrors extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    ts: 'timestamp with time zone',
    message: 'varchar',
  } as const;
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const query = `
      select ts, message
      from iasql_audit_log
      where change_type = 'ERROR'
      order by ts desc limit 500;
    `;
    const errors = await (ctx.orm as TypeormWrapper).query(query);
    return errors;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
