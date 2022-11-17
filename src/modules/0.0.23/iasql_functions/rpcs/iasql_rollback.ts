import { createConnection } from 'typeorm';

import { IasqlFunctions } from '..';
import * as dbMan from '../../../../services/db-manager';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import * as iasql from '../iasql';

export class IasqlRollback extends RpcBase {
  module: IasqlFunctions;
  outputTable = {
    action: 'varchar',
    table_name: 'varchar',
    id: 'varchar',
    description: 'varchar',
  } as const;
  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    let res;
    let conn: any;
    try {
      res = (await iasql.rollback(dbId, ctx)).rows;
      conn = await createConnection(dbMan.baseConnConfig);
      await conn.query(dbMan.startCron(dbId));
    } catch (e) {
      throw e;
    } finally {
      conn?.close();
    }
    return (
      res?.map(rec => super.formatObjKeysToSnakeCase(rec) as RpcResponseObject<typeof this.outputTable>) ?? []
    );
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}
