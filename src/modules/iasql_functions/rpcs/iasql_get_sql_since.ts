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
    let queries: string[];
    try {
      const changeLogs = await getChangeLogs(limitDate, ctx.orm);
      const installedModules = await getInstalledModules(ctx.orm);
      const modsIndexedByTable = indexModsByTable(installedModules);
      queries = await recreateQueries(changeLogs, modsIndexedByTable, ctx.orm);
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
 * Returns the relevant `IasqlAuditLog`s order by timestamp with the older logs first.
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

/**
 * @internal
 * Returns the queries recreated from the change logs.
 */
async function recreateQueries(
  changeLogs: IasqlAuditLog[],
  modsIndexedByTable: { [key: string]: ModuleInterface },
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
            .map(
              async ([k, v]: [string, any]) =>
                await jsonValueToDbString(cl.tableName, k, v, modsIndexedByTable, orm),
            ),
        );
        query = `
          INSERT INTO ${cl.tableName} (${Object.keys(cl.change?.change ?? {})
          .filter((k: string) => k !== 'id' && cl.change?.change[k] !== null)
          .join(', ')})
          VALUES (${valuesToInsert.join(', ')});
        `;
        break;
      case AuditLogChangeType.DELETE:
        const valuesDeleted = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(
              async ([k, v]: [string, any]) =>
                await jsonValueToDbString(cl.tableName, k, v, modsIndexedByTable, orm),
            ),
        );
        query = `
          DELETE FROM ${cl.tableName}
          WHERE ${Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(([k, _]: [string, any], i) => `${k} = ${valuesDeleted[i]}`)
            .join(' AND ')};
        `;
        break;
      case AuditLogChangeType.UPDATE:
        const updatedValues = await Promise.all(
          Object.entries(cl.change?.change ?? {})
            .filter(([k, _]: [string, any]) => k !== 'id')
            .map(
              async ([k, v]: [string, any]) =>
                await jsonValueToDbString(cl.tableName, k, v, modsIndexedByTable, orm),
            ),
        );
        const oldValues = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
            .filter(([k, _]: [string, any]) => k !== 'ami' && k !== 'id')
            .map(
              async ([k, v]: [string, any]) =>
                await jsonValueToDbString(cl.tableName, k, v, modsIndexedByTable, orm),
            ),
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
            .map(([k, _]: [string, any], i) => `${k} = ${oldValues[i]}`)
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

/**
 * @internal
 * The changes from iasql_audit_log are stored as JSON, so we need to transform them and return a valid value for the query.
 */
async function jsonValueToDbString(
  tableName: string,
  key: string,
  value: any,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string> {
  if (value === undefined || typeof value === 'string' || typeof value === 'object') {
    return getDbString(value);
  }
  // If `value`'s type is `number` we might need to recreate a sub-query because it could be an `id` referencing other table.
  // In this case we need to get Typeorm metadata for this `tableName` and inspect columns and relations and recreate the sub-query if necessary.
  // We need to recreate the sub-query because database `id` columns will not be the same across databases connected to the same cloud account.
  const metadata = await getMetadata(tableName, modsIndexedByTable, orm);
  if (value && typeof value === 'number' && metadata) {
    // If `metadata instanceof EntityMetadata` means that there's an Entity in Typeorm which it's table name is `tableName`
    if (metadata instanceof EntityMetadata) {
      const keyRelationMetadata = metadata.ownColumns
        .filter(oc => oc.databaseName === key && oc.referencedColumn?.databaseName === 'id')
        .map(oc => oc.relationMetadata)
        ?.pop();
      if (keyRelationMetadata) {
        return await recreateSubQuery(
          value,
          keyRelationMetadata.inverseEntityMetadata,
          modsIndexedByTable,
          orm,
        );
      }
    }
    // If `metadata instanceof RelationMetadata` means that there's no Entity in Typeorm which it's table name is `tableName`,
    // but theres a join table linking entities and `tableName` is that join table. In this case we need to check `joinColumns`
    // which will have the columns from the owner of the relationship and `inverseJoinColumns` will have the columns coming from
    // the other entities in the relationship.
    if (metadata instanceof RelationMetadata) {
      const keyRelationMetadata = metadata.joinColumns
        .filter(jc => jc.databaseName === key && jc.referencedColumn?.databaseName === 'id')
        .map(jc => jc.relationMetadata)
        ?.pop();
      if (keyRelationMetadata) {
        return await recreateSubQuery(value, keyRelationMetadata.entityMetadata, modsIndexedByTable, orm);
      }
      const keyInverseRelationMetadata = metadata.inverseJoinColumns
        .filter(jc => jc.databaseName === key && jc.referencedColumn?.databaseName === 'id')
        .map(jc => jc.relationMetadata)
        ?.pop();
      if (keyInverseRelationMetadata) {
        return await recreateSubQuery(
          value,
          keyInverseRelationMetadata.inverseEntityMetadata,
          modsIndexedByTable,
          orm,
        );
      }
    }
  }
  return `${value}`;
}

/** @internal */
function getDbString(v: any): string {
  if (v === undefined) return `${null}`;
  if (typeof v === 'string') return `'${v}'`;
  if (v && typeof v === 'object' && !Array.isArray(v)) return `'${JSON.stringify(v)}'`;
  if (v && typeof v === 'object' && Array.isArray(v)) return `'{${v.map(o => getDbString(o)).join(',')}}'`;
  return `${v}`;
}

/**
 * @internal
 * Returns Typeorm metadata related to `tableName`
 */
async function getMetadata(
  tableName: string,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<EntityMetadata | RelationMetadata | undefined> {
  const mappers = Object.values(modsIndexedByTable[tableName] ?? {}).filter(val => val instanceof MapperBase);
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
  // If no metadata found, we need to do a second pass over the mappers because it could be the case of an
  // Entity that does not have it's own mapper but it is managed by another Entity Mapper.
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
  return metadata;
}

/**
 * @internal
 * Returns sub-query based on `id` relation.
 * The related entity will be found using the cloud columns decorators.
 */
async function recreateSubQuery(
  id: number,
  entityMetadata: EntityMetadata,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string> {
  // Get cloud columns of the entity we want to look for.
  const cloudColumns = getCloudId(entityMetadata?.target);
  if (cloudColumns && !(cloudColumns instanceof Error)) {
    let e: any;
    try {
      e = await orm.findOne(entityMetadata?.targetName ?? '', { where: { id } });
    } catch (e: any) {
      logger.warn(e.message ?? 'Error finding relation');
      e = null;
    }
    const values = await Promise.all(
      cloudColumns.map(
        async (cc: string) =>
          await jsonValueToDbString(entityMetadata.tableName, cc, e[cc], modsIndexedByTable, orm),
      ),
    );
    return `(SELECT id FROM ${entityMetadata?.tableName} WHERE ${cloudColumns
      .map((cc, i) => `${snakeCase(cc)} = ${values[i] !== undefined ? values[i] : '<unknown value>'}`)
      .join(' AND ')})`;
  }
  return '';
}
