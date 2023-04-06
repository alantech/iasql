import { In, Not } from 'typeorm';

import { IasqlFunctions } from '..';
import { RpcInput } from '../..';
import config from '../../../config';
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

/**
 * Method that generates SQL from the audit log for a given transaction identifier.
 */
export class IasqlGetSqlForTransaction extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  inputTable: RpcInput = {
    transactionId: { argType: 'varchar', default: null, rawDefault: true },
  };
  /** @internal */
  outputTable = {
    sql: 'varchar',
  } as const;

  documentation = {
    description: 'Generate SQL from the audit log for a given transaction identifier',
    sampleUsage: "SELECT * FROM iasql_get_sql_for_transaction('571b7894-ea96-413a-b1dd-7596c2b7a36c')",
  };

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    transactionId: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    let queries: string[];
    try {
      const changeLogs = await getUserChangeLogsByTransaction(ctx.orm, transactionId);
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
 * Returns the relevant `IasqlAuditLog`s ordered by timestamp with older logs first.
 */
async function getUserChangeLogsByTransaction(
  orm: TypeormWrapper,
  transactionId: string,
): Promise<IasqlAuditLog[]> {
  let id = transactionId;
  // If no `transactionId` we get the latest transaction
  if (!id) {
    const latestOpenTransaction: IasqlAuditLog = await orm.findOne(IasqlAuditLog, {
      order: { ts: 'DESC' },
      where: {
        changeType: AuditLogChangeType.OPEN_TRANSACTION,
      },
    });
    id = latestOpenTransaction.transactionId;
  }
  return orm.find(IasqlAuditLog, {
    order: { ts: 'ASC', id: 'ASC' },
    where: {
      changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
      transactionId: id,
      user: Not(config.db.user),
    },
  });
}
