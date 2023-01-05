import { In, MoreThan } from 'typeorm';

import { IasqlFunctions } from '..';
import * as AllModules from '../../../modules';
import { TypeormWrapper } from '../../../services/typeorm';
import { AuditLogChangeType, IasqlAuditLog, IasqlModule } from '../../iasql_platform/entity';
import {
  Context,
  MapperBase,
  ModuleInterface,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';
import { indexModsByTable } from '../iasql';

/**
 * Method that generates SQL from the audit log from a given point in time.
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_get_sql_since();
 * ```
 *
 */
export class IasqlGetSqlSince extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  outputTable = {
    sql: 'varchar',
  } as const;

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    limitDate: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const queries: string[] = [];
    try {
      const whereClause: any = {
        changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
      };
      if (limitDate) {
        const castRes = await ctx.orm.query(
          `SELECT try_cast('${limitDate}', NULL::timestamp with time zone);`,
        );
        const castedValue = castRes?.pop()?.try_cast;
        if (castedValue === null) throw new Error(`Cannot cast ${limitDate} to timestamp with time zone`);
        whereClause.ts = MoreThan(new Date(castedValue));
      }
      const changeLogs = await ctx.orm.find(IasqlAuditLog, {
        order: { ts: 'ASC' },
        where: whereClause,
      });
      const installedModulesNames = (await ctx.orm.find(IasqlModule)).map((m: any) => m.name);
      const installedModules: ModuleInterface[] = (Object.values(AllModules) as ModuleInterface[]).filter(
        mod => installedModulesNames.includes(`${mod.name}@${mod.version}`),
      );
      const modsIndexedByTable = indexModsByTable(installedModules);
      queries.push(...(await getQueries(changeLogs, modsIndexedByTable, ctx.orm)));
    } catch (e) {
      throw e;
    }
    return queries.map(q => ({ sql: q }));
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}

//** TODO: REUSE FUNCTIONS FROM ROLLBACK PR */

async function getQueries(
  changeLogs: IasqlAuditLog[],
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string[]> {
  const inverseQueries: string[] = [];
  let values: any[];
  for (const cl of changeLogs) {
    let inverseQuery: string = '';
    switch (cl.changeType) {
      case AuditLogChangeType.INSERT:
        values = await Promise.all(
          Object.entries(cl.change?.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt[cl.tableName], orm)),
        );
        inverseQuery = `
          INSERT INTO ${cl.tableName} (${Object.keys(cl.change?.change ?? {})
          .filter((k: string) => k !== 'id' && cl.change?.change[k] !== null)
          .join(', ')})
          VALUES (${values.join(', ')});
        `;
        break;
      case AuditLogChangeType.DELETE:
        inverseQuery = `
          DELETE FROM ${cl.tableName}
          WHERE ${Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(([k, v]: [string, any]) => getCondition(k, v))
            .join(' AND ')};
        `;
        break;
      case AuditLogChangeType.UPDATE:
        values = await Promise.all(
          Object.entries(cl.change?.change ?? {}).map(
            async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt[cl.tableName], orm),
          ),
        );
        inverseQuery = `
          UPDATE ${cl.tableName}
          SET ${Object.entries(cl.change?.change ?? {})
            .map(([k, _]: [string, any], i) => `${k} = ${values[i]}`)
            .join(', ')}
          WHERE ${Object.entries(cl.change?.original ?? {})
            // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
            .filter(([k, _]: [string, any]) => k !== 'ami')
            .map(([k, v]: [string, any]) => getCondition(k, v))
            .join(' AND ')};
        `;
        break;
      default:
        break;
    }
    if (inverseQuery) inverseQueries.push(inverseQuery);
  }
  return inverseQueries;
}

function getCondition(k: string, v: any): string {
  if (typeof v === 'string') return `${k} = '${v}'`;
  if (v && typeof v === 'object') return `${k}::jsonb = '${JSON.stringify(v)}'::jsonb`;
  return `${k} = ${v}`;
}

async function getValue(
  tableName: string,
  k: string,
  v: any,
  mod: ModuleInterface,
  orm: TypeormWrapper,
): Promise<string> {
  if (v === undefined) return `${null}`;
  if (typeof v === 'string') return `'${v}'`;
  if (v && typeof v === 'object' && Array.isArray(v)) {
    const mappers = Object.values(mod).filter(val => val instanceof MapperBase);
    for (const m of mappers) {
      const metadata = await orm.getEntityMetadata((m as MapperBase<any>).entity);
      if (
        metadata.tableName === tableName &&
        metadata.ownerColumns
          .filter(oc => oc.isArray)
          .map(oc => oc.databaseName)
          .includes(k)
      ) {
        return `'{${v.join(',')}}'`;
      }
    }
  }
  if (v && typeof v === 'object') return `'${JSON.stringify(v)}'`;
  return `${v}`;
}
