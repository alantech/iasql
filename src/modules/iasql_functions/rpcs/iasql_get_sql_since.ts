import { In, MoreThan } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

import { IasqlFunctions } from '..';
import * as AllModules from '../../../modules';
import { getCloudId } from '../../../services/cloud-id';
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
import logger from '../../../services/logger';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

/**
 * Method that generates SQL from the audit log from a given point in time.
 *
 * @example
 * ```sql
 * SELECT * FROM iasql_get_sql_since();
 * SELECT * FROM iasql_get_sql_since('2023-01-05T12:00:00');
 * SELECT * FROM iasql_get_sql_since((now() - interval '5 minutes')::text);
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
      const changeLogs = await getChangeLogs(limitDate, ctx.orm);
      const installedModules = await getInstalledModules(ctx.orm);
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

/** @internal */
async function getChangeLogs(limitDate: string, orm: TypeormWrapper): Promise<IasqlAuditLog[]> {
  const whereClause: any = {
    changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
  };
  if (limitDate) {
    const castRes = await orm.query(`SELECT try_cast('${limitDate}', NULL::timestamp with time zone);`);
    const castedValue = castRes?.pop()?.try_cast;
    if (castedValue === null) throw new Error(`Cannot cast ${limitDate} to timestamp with time zone`);
    whereClause.ts = MoreThan(new Date(castedValue));
  }
  return orm.find(IasqlAuditLog, {
    order: { ts: 'ASC' },
    where: whereClause,
  });
}

/** @internal */
async function getInstalledModules(orm: TypeormWrapper): Promise<ModuleInterface[]> {
  const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
  return (Object.values(AllModules) as ModuleInterface[]).filter(mod =>
    installedModulesNames.includes(`${mod.name}@${mod.version}`),
  );
}

//** TODO: REUSE FUNCTIONS FROM ROLLBACK PR ? */
/** @internal */
async function getQueries(
  changeLogs: IasqlAuditLog[],
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string[]> {
  const queries: string[] = [];
  let values: any[];
  for (const cl of changeLogs) {
    let query: string = '';
    switch (cl.changeType) {
      case AuditLogChangeType.INSERT:
        values = await Promise.all(
          Object.entries(cl.change?.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm)),
        );
        query = `
          INSERT INTO ${cl.tableName} (${Object.keys(cl.change?.change ?? {})
          .filter((k: string) => k !== 'id' && cl.change?.change[k] !== null)
          .join(', ')})
          VALUES (${values.join(', ')});
        `;
        break;
      case AuditLogChangeType.DELETE:
        query = `
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
            async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm),
          ),
        );
        query = `
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
    if (query) queries.push(query);
  }
  return queries;
}
/** @internal */
function getCondition(k: string, v: any): string {
  if (typeof v === 'string') return `${k} = '${v}'`;
  if (v && typeof v === 'object') return `${k}::jsonb = '${JSON.stringify(v)}'::jsonb`;
  return `${k} = ${v}`;
}

/** @internal */
async function getValue(
  tableName: string,
  k: string,
  v: any,
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string> {
  if (v === undefined) return `${null}`;
  if (typeof v === 'string') return `'${v}'`;
  if (v && typeof v === 'object' && !Array.isArray(v)) return `'${JSON.stringify(v)}'`;

  const mappers = Object.values(mbt[tableName]).filter(val => val instanceof MapperBase);
  let tableMetadata, tableEntity;
  for (const m of mappers) {
    tableEntity = (m as MapperBase<any>).entity;
    const metadata = await orm.getEntityMetadata(tableEntity);
    if (metadata.tableName === tableName) {
      tableMetadata = metadata;
      break;
    }
  }

  if (
    v &&
    typeof v === 'object' &&
    Array.isArray(v) &&
    tableMetadata?.ownColumns
      .filter(oc => oc.isArray)
      .map(oc => oc.databaseName)
      .includes(k)
  ) {
    return `'{${v.join(',')}}'`;
  }

  if (v && typeof v === 'number') {
    const relationsMetadata = tableMetadata?.ownColumns
      .filter(
        oc =>
          oc.databaseName === k &&
          oc.referencedColumn?.databaseName === 'id' &&
          !!oc.relationMetadata?.isEager,
      )
      .map(oc => oc.relationMetadata);
    const relationMetadata = relationsMetadata?.pop();
    if (relationMetadata) {
      const subQuery = await getValueSubQuery(v, relationMetadata, orm, mbt);
      if (subQuery) return subQuery;
    }
  }

  return `${v}`;
}

async function getValueSubQuery(id: number, relationMetadata: RelationMetadata, orm: TypeormWrapper, 
  mbt: { [key: string]: ModuleInterface },
  
  ): Promise<string | undefined> {
  const targetEntityMetadata = relationMetadata.inverseEntityMetadata;
  const cloudColumns = getCloudId(relationMetadata.inverseEntityMetadata?.target);
  console.log(`+-+ ${JSON.stringify(cloudColumns)}`);
  if (cloudColumns && !(cloudColumns instanceof Error)) {
    let ccVal: any;
    console.log(`+-+ ${relationMetadata.inverseEntityMetadata?.targetName}`);
    try {
      ccVal =  await orm.findOne(relationMetadata.inverseEntityMetadata?.targetName ?? '', { where: { id } });
    } catch (e: any) {
      logger.warn(e.message ?? 'Error finding relation');
      ccVal = null;
    }
    console.log(`+-+ ${JSON.stringify(ccVal)}`);
    const values = await Promise.all(
      cloudColumns.map(async (k: string) => await getValue(relationMetadata.inverseEntityMetadata.tableName, k, ccVal[k], mbt, orm)),
    );
    return `(SELECT id FROM ${
      targetEntityMetadata?.tableName
    } WHERE ${cloudColumns.map(
      (cc, i) =>
        `${snakeCase(cc)} = ${values[i] !== undefined ? values[i] : '<unknown value>'}`,
    ).join(' AND ')})`;
  }
}