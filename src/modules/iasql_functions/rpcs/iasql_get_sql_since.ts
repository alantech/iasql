import { EntityMetadata, In, MoreThan } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { snakeCase } from 'typeorm/util/StringUtils';

import { IasqlFunctions } from '..';
import * as AllModules from '../../../modules';
import { getCloudId } from '../../../services/cloud-id';
import logger from '../../../services/logger';
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

/** @internal */
async function getQueries(
  changeLogs: IasqlAuditLog[],
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string[]> {
  const queries: string[] = [];
  for (const cl of changeLogs) {
    let query: string = '';
    switch (cl.changeType) {
      case AuditLogChangeType.INSERT:
        const valuesToInsert = await Promise.all(
          Object.entries(cl.change?.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm)),
        );
        query = `
          INSERT INTO ${cl.tableName} (${Object.keys(cl.change?.change ?? {})
          .filter((k: string) => k !== 'id' && cl.change?.change[k] !== null)
          .join(', ')})
          VALUES (${valuesToInsert.join(', ')});
        `;
        break;
      case AuditLogChangeType.DELETE:
        const valuesToDelete = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm)),
        );
        query = `
          DELETE FROM ${cl.tableName}
          WHERE ${Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(([k, _]: [string, any], i) => `${k} = ${valuesToDelete[i]}`)
            .join(' AND ')};
        `;
        break;
      case AuditLogChangeType.UPDATE:
        const updatedValues = await Promise.all(
          Object.entries(cl.change?.change ?? {})
            .filter(([k, _]: [string, any]) => k !== 'id')
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm)),
        );
        const conditionValues = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            .filter(([k, _]: [string, any]) => k !== 'ami' && k !== 'id')
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt, orm)),
        );
        query = `
          UPDATE ${cl.tableName}
          SET ${Object.entries(cl.change?.change ?? {})
            .filter(([k, _]: [string, any]) => k !== 'id')
            .map(([k, _]: [string, any], i) => `${k} = ${updatedValues[i]}`)
            .join(', ')}
          WHERE ${Object.entries(cl.change?.original ?? {})
            // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
            .filter(([k, _]: [string, any]) => k !== 'ami' && k !== 'id')
            .map(([k, _]: [string, any], i) => `${k} = ${conditionValues[i]}`)
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
async function getValue(
  tableName: string,
  k: string,
  v: any,
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string> {
  if (v === undefined || typeof v === 'string' || typeof v === 'object') {
    return getVal(v);
  }
  const mappers = Object.values(mbt[tableName] ?? {}).filter(val => val instanceof MapperBase);
  let metadata: EntityMetadata | RelationMetadata | undefined;
  for (const m of mappers) {
    const tableEntity = (m as MapperBase<any>).entity;
    const entityMetadata = await orm.getEntityMetadata(tableEntity);
    if (entityMetadata.tableName === tableName) {
      metadata = entityMetadata;
      break;
    } else {
      if (
        entityMetadata.ownRelations
          .filter(or => !!or.joinTableName)
          .map(or => or.joinTableName)
          .includes(tableName)
      ) {
        metadata = entityMetadata.ownRelations.find(or => or.joinTableName === tableName);
        break;
      }
    }
  }

  // todo: add explanation for this second loop
  if (!metadata) {
    for (const m of mappers) {
      const tableEntity = (m as MapperBase<any>).entity;
      const entityMetadata = await orm.getEntityMetadata(tableEntity);
      if (
        entityMetadata.ownRelations
          .filter(or => !!or.inverseEntityMetadata.tableName)
          .map(or => or.inverseEntityMetadata.tableName)
          .includes(tableName)
      ) {
        metadata = entityMetadata.ownRelations.find(
          or => or.inverseEntityMetadata.tableName === tableName,
        )?.inverseEntityMetadata;
        break;
      }
    }
  }

  if (v && typeof v === 'number') {
    let relationsMetadata;
    if (metadata && metadata instanceof RelationMetadata) {
      relationsMetadata = metadata.joinColumns
        .filter(jc => jc.databaseName === k && jc.referencedColumn?.databaseName === 'id')
        .map(jc => jc.relationMetadata);
      const relationMetadata = relationsMetadata?.pop();
      if (relationMetadata) {
        const subQuery = await getValueSubQuery(v, relationMetadata.entityMetadata, orm, mbt);
        return subQuery;
      }
      relationsMetadata = metadata.inverseJoinColumns
        .filter(jc => jc.databaseName === k && jc.referencedColumn?.databaseName === 'id')
        .map(jc => jc.relationMetadata);
      const inverseRelationMetadata = relationsMetadata?.pop();
      if (inverseRelationMetadata) {
        const subQuery = await getValueSubQuery(v, inverseRelationMetadata.inverseEntityMetadata, orm, mbt);
        return subQuery;
      }
    } else {
      relationsMetadata = metadata?.ownColumns
        .filter(oc => oc.databaseName === k && oc.referencedColumn?.databaseName === 'id')
        .map(oc => oc.relationMetadata);
      const relationMetadata = relationsMetadata?.pop();
      if (relationMetadata) {
        const subQuery = await getValueSubQuery(v, relationMetadata.inverseEntityMetadata, orm, mbt);
        return subQuery;
      }
    }
  }

  return `${v}`;
}

function getVal(v: any): string {
  if (v === undefined) return `${null}`;
  if (typeof v === 'string') return `'${v}'`;
  if (v && typeof v === 'object' && !Array.isArray(v)) return `'${JSON.stringify(v)}'`;
  if (v && typeof v === 'object' && Array.isArray(v)) return `'{${v.map(o => getVal(o)).join(',')}}'`;
  return `${v}`;
}

async function getValueSubQuery(
  id: number,
  entityMetadata: EntityMetadata,
  orm: TypeormWrapper,
  mbt: { [key: string]: ModuleInterface },
): Promise<string> {
  const cloudColumns = getCloudId(entityMetadata?.target);
  if (cloudColumns && !(cloudColumns instanceof Error)) {
    let ccVal: any;
    try {
      ccVal = await orm.findOne(entityMetadata?.targetName ?? '', { where: { id } });
    } catch (e: any) {
      logger.warn(e.message ?? 'Error finding relation');
      ccVal = null;
    }
    const values = await Promise.all(
      cloudColumns.map(async (k: string) => await getValue(entityMetadata.tableName, k, ccVal[k], mbt, orm)),
    );
    return `(SELECT id FROM ${entityMetadata?.tableName} WHERE ${cloudColumns
      .map((cc, i) => `${snakeCase(cc)} = ${values[i] !== undefined ? values[i] : '<unknown value>'}`)
      .join(' AND ')})`;
  }
  return '';
}
