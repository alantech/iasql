import { In, MoreThan } from 'typeorm';

import { IasqlFunctions } from '..';
import { RpcInput } from '../../../modules';
import { TypeormWrapper } from '../../../services/typeorm';
import { AuditLogChangeType, IasqlAuditLog } from '../../iasql_platform/entity';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';
import { getInstalledModules, recreateQueries } from '../iasql';
import { indexModsByTable } from '../iasql';

// import { recreateQueries } from './helpers';

/**
 * Method that generates SQL from the audit log from a given point in time.
 */
export class IasqlGetSqlSince extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  inputTable: RpcInput = {
    limitDate: { argType: 'timestamp with time zone', default: null, rawDefault: true },
  };
  /** @internal */
  outputTable = {
    sql: 'varchar',
  } as const;

  documentation = {
    description: 'Generate SQL from the audit log from a given point in time',
    sampleUsage: "SELECT * FROM iasql_get_sql_since(now() - interval '30 minutes')",
  };

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    limitDate: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    let queries: string[];
    try {
      const changeLogs = await getChangeLogs(limitDate, ctx.orm);
      const installedModules = await getInstalledModules(ctx.orm);
      const modsIndexedByTable = indexModsByTable(installedModules);
      queries = await recreateQueries(changeLogs, modsIndexedByTable, ctx.orm, false, true);
    } catch (e) {
      throw e;
    }
    return (queries ?? []).map(q => ({ sql: q }));
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}

/**
 * @internal
 * Returns the relevant `IasqlAuditLog`s order by timestamp with older logs first.
 */
async function getChangeLogs(limitDate: string, orm: TypeormWrapper): Promise<IasqlAuditLog[]> {
  const whereClause: any = {
    changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
  };
  if (limitDate) {
    // `try_cast` will try to return the `limitDate` casted as `timestamp with time zone` or `null`if the cast fails
    const castRes = await orm.query(`SELECT try_cast('${limitDate}', NULL::timestamp with time zone);`);
    const castedValue = castRes?.pop()?.try_cast;
    if (castedValue === undefined || castedValue === null) {
      throw new Error(`Cannot cast ${limitDate} to timestamp with time zone`);
    }
    whereClause.ts = MoreThan(new Date(castedValue));
  }
  return orm.find(IasqlAuditLog, {
    order: { ts: 'ASC', id: 'ASC' },
    where: whereClause,
  });
}
