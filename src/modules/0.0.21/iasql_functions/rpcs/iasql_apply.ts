import { snakeCase } from 'typeorm/util/StringUtils';

import { IasqlFunctions } from '..';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlApply extends RpcBase {
  module: IasqlFunctions;
  name = 'iasql_apply';
  output = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    _ctx: Context,
  ): Promise<RpcResponseObject<typeof this.output>[]> => {
    const applyRes = (await iasql.apply(dbId, false)).rows;
    const formattedRes = applyRes.map(rec =>
      Object.keys(rec).reduce((acc, key) => {
        acc[snakeCase(key)] = rec[key];
        return acc;
      }, {} as any),
    );
    return formattedRes;
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
